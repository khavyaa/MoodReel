/*
 * Books and their films or series. The pull is one way: a film of a book you've
 * read is one you'd love to see, but once you've seen the film you rarely go
 * back for the book. So a film of a book you read ranks higher (more if you
 * rated the book well), and a book you know from the screen ranks well down.
 * Only the linked title moves; general taste is untouched.
 */

/** TMDb keyword "based on novel or book", for the "adaptations only" pools. */
export const BASED_ON_BOOK = 818;

/** A film or series of a book you've read, not rated. Rated, it's 0.06 + 0.012 × rating (0.18 at 10). */
export const READ_BOOST = 0.12;
/** A film or series of a book you disliked or rated low. */
export const DISLIKED_BOOK = -0.15;
/** A book whose film or series you've seen. */
export const SEEN_SCREEN_PENALTY = 0.3;

export type LinkState = { seen: boolean; rating: number | null; disliked: boolean };

/** You know the story in this form: a Seen it / Read it swipe, or finished and rated. */
export const knows = (s: LinkState | null | undefined) => Boolean(s && (s.seen || s.rating !== null));

/** How much a film or series moves, from what you made of its book. */
export function screenBonus(book: LinkState | undefined): number {
  if (!book) return 0;
  if (book.disliked || (book.rating !== null && book.rating <= 4)) return DISLIKED_BOOK;
  if (!knows(book)) return 0;
  return book.rating === null ? READ_BOOST : 0.06 + book.rating * 0.012;
}

/** How much a book moves, from its films and series you know. */
export function bookBonus(screens: (LinkState | undefined)[]): number {
  return screens.some(knows) ? -SEEN_SCREEN_PENALTY : 0;
}

export type Link = { bookId: number; screenId: number };

/** Per film or series id: the bonus from its book (the strongest, if several books). */
export function bonusByScreen(links: Link[], bookStates: Map<number, LinkState>): Map<number, number> {
  const out = new Map<number, number>();
  for (const l of links) {
    const b = screenBonus(bookStates.get(l.bookId));
    if (b !== 0 && Math.abs(b) > Math.abs(out.get(l.screenId) ?? 0)) out.set(l.screenId, b);
  }
  return out;
}

/** Per book id: the penalty when you know any of its films or series. */
export function bonusByBook(links: Link[], screenStates: Map<number, LinkState>): Map<number, number> {
  const byBook = new Map<number, (LinkState | undefined)[]>();
  for (const l of links) byBook.set(l.bookId, [...(byBook.get(l.bookId) ?? []), screenStates.get(l.screenId)]);
  const out = new Map<number, number>();
  for (const [id, states] of byBook) {
    const b = bookBonus(states);
    if (b !== 0) out.set(id, b);
  }
  return out;
}

/** At most this many films or series of books you've read in one deck (more with "adaptations only"). */
export const MAX_FROM_READ = { mixed: 3, only: 6 } as const;

/** Keeps the best few titles a book you read boosted; input best-first. */
export function capFromBooks<T>(ranked: T[], boosted: (t: T) => boolean, max: number): T[] {
  let n = 0;
  return ranked.filter((t) => !boosted(t) || n++ < max);
}

/** What one deal knows about adaptations. */
export type AdaptFilter = {
  /** Score changes per title id, from the linked title's state. */
  bonus: Map<number, number>;
  /** Every title id with a known link to the other medium. */
  linked: Set<number>;
  /** "Adaptations only" is on. */
  only: boolean;
};

export const NO_ADAPT: AdaptFilter = { bonus: new Map(), linked: new Set(), only: false };

/** With "adaptations only" on, keeps titles with a link, or tagged by TMDb as based on a book. */
export function keepAdaptations<T>(items: T[], idOf: (t: T) => number, filter: AdaptFilter, tagged: Set<number> = new Set()): T[] {
  if (!filter.only) return items;
  return items.filter((t) => filter.linked.has(idOf(t)) || tagged.has(idOf(t)));
}

/** Pure: Wikidata's CSV answer as (TMDb id, Open Library id) pairs. Open Library ids are works (…W) or editions (…M). */
export function parseWikidataCsv(csv: string): { screenId: number; ol: string }[] {
  return csv
    .split(/\r?\n/)
    .slice(1)
    .flatMap((line) => {
      const [tmdb, ol] = line.split(",").map((s) => s.trim());
      const screenId = Number(tmdb);
      if (!Number.isInteger(screenId) || screenId <= 0 || !/^OL\d+[WM]$/.test(ol ?? "")) return [];
      return [{ screenId, ol }];
    });
}

/** The other side of a card's link, as the card shows it. Sent to the browser. */
export type TitleLink = {
  media: "movie" | "series" | "book";
  id: number;
  title: string;
  year: number | null;
  /** The author, or the director or creator. */
  by: string | null;
  posterPath: string | null;
  /** You know this one: read it or seen it. */
  known: boolean;
  /** Your rating, 1–10. */
  rating: number | null;
  /** For "I've read it": what a Read it swipe would log. */
  language: string;
  genreIds: number[];
  tags: string[];
};
