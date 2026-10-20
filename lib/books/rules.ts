import type { MoodId } from "@/lib/moods";
import type { MovieCandidate, Taps } from "@/lib/taste/types";
import { NO_TASTE, type TasteProfile } from "@/lib/taste/rules";

/*
 * Book rules. Open Library is the catalogue: subjects, page counts, covers and
 * reader ratings (1–5). Its ratings are thin (a famous book has a few hundred),
 * so quality also uses how many people logged it as read and how long it spent
 * on the New York Times bestseller lists. Thresholds from probing Open Library
 * (Oct 2026).
 */

/** A book in the deck pipeline. Shaped like a film candidate so composing and curation are shared. */
export type BookCandidate = MovieCandidate & {
  authors: string[];
  /** Open Library author numbers (OL…A), paired with names. */
  authorIds: { id: number; name: string }[];
  pages: number | null;
  subjects: string[];
  ratingsCount: number;
  readCount: number;
  /** Weeks on the NYT lists, from the weekly sync, or estimated from Open Library's NYT subject tags. */
  nytWeeks: number;
  /** Whether Open Library has an English edition (search with `lang=en` returns it first); unknown without edition data. */
  englishEdition?: boolean;
};

/* ------------------------------------------------------------------ gates */

/**
 * Never: children's and young adult, romance and romantasy, self-help and
 * business, comics and graphic novels. Matched against lower-cased subjects,
 * since Open Library's subject tags are free text.
 */
export const NEVER_SUBJECTS: readonly string[] = [
  "juvenile",
  "children",
  "middle grade",
  "young adult",
  "ya fiction",
  "picture book",
  "school stories",
  "romance",
  "love stories",
  "self-help",
  "self-realization",
  "self-actualization",
  "motivation (psychology)",
  "success",
  "business",
  "management",
  "personal finance",
  "comic books",
  "comics",
  "graphic novel",
  "manga",
  // Library classification codes for comics, which some graphic novels carry instead of a subject.
  "741.5",
  "pn6728",
  "pn6727",
  "nyt:advice",
  "nyt:young-adult",
  "nyt:childrens",
  "nyt:graphic",
  "nyt:picture",
  "nyt:series-books",
];

/** The same exclusions as an Open Library query, so pools aren't wasted on them. */
export const NEVER_QUERY = [
  '-subject:"juvenile fiction"',
  '-subject:"juvenile literature"',
  '-subject:"young adult fiction"',
  '-subject:"middle grade fiction"',
  "-subject:romance",
  '-subject:"self-help"',
  "-subject:success",
  "-subject:business",
  '-subject:"comic books, strips, etc."',
  '-subject:"graphic novels"',
  "-subject:manga",
].join(" ");

export function hasNeverSubject(subjects: string[]): boolean {
  return subjects.some((s) => {
    const lower = s.toLowerCase();
    return NEVER_SUBJECTS.some((term) => lower.includes(term));
  });
}

/** Weighted rating on Open Library's 1–5 scale: few ratings pull towards a typical 3.85. */
export const BOOK_PRIOR = { mean: 3.85, votes: 30 } as const;

export function bookRating(book: Pick<BookCandidate, "voteAverage" | "voteCount">): number {
  const v = Math.max(0, book.voteCount);
  const m = BOOK_PRIOR.votes;
  return (v / (v + m)) * book.voteAverage + (m / (v + m)) * BOOK_PRIOR.mean;
}

/** In if it's well rated by enough readers, or a lasting bestseller that readers don't dislike. */
export function bookGate(book: BookCandidate): { ok: boolean; reason?: "acclaimed" } {
  if (hasNeverSubject(book.subjects)) return { ok: false };
  if (book.voteCount >= 10 && bookRating(book) >= 3.95) return { ok: true };
  if (book.nytWeeks >= 4 && (book.voteCount < 10 || book.voteAverage >= 3.7)) return { ok: true };
  return { ok: false };
}

/* ------------------------------------------------------------------ moods */

export type BookMoodRule = {
  /** Open Library subjects to query (any of). */
  subjects: string[];
  /** Lower-cased fragments that make a book fit, matched against its subjects. */
  fits: string[];
  /** Fragments that rule a book out of this mood. */
  exclude: string[];
};

export const BOOK_MOODS: Record<Exclude<MoodId, "romantic">, BookMoodRule> = {
  gripping: {
    subjects: ["thriller", "suspense", "crime fiction", "detective and mystery stories", "true crime"],
    fits: ["thriller", "suspense", "crime", "mystery", "detective", "murder"],
    exclude: ["humor", "humorous"],
  },
  dark: {
    subjects: ["psychological fiction", "horror", "dystopias", "noir fiction"],
    fits: ["psychological", "horror", "dystopia", "noir", "serial murder", "grief", "war"],
    exclude: ["humor", "humorous", "comic"],
  },
  mind: {
    subjects: ["science fiction", "time travel", "speculative fiction", "alternative histories"],
    fits: ["science fiction", "time travel", "speculative", "alternative histor", "artificial intelligence", "space"],
    exclude: ["memoir", "autobiograph"],
  },
  funny: {
    subjects: ["humor", "satire", "humorous fiction", "comic fiction", "humorous stories", "wit and humor"],
    fits: ["humor", "humour", "humorous", "satire", "comedy", "comic fiction", "wit and"],
    // Christie mysteries come tagged "Humour"; a murder isn't a comedy.
    exclude: ["horror", "holocaust", "murder", "mystery and detective", "serial"],
  },
  feelgood: {
    subjects: ["friendship", "domestic fiction", "humorous fiction", "families", "small town life", "community life"],
    fits: ["friendship", "humorous", "neighbors", "found family", "kindness", "domestic fiction", "small town", "community life", "families"],
    exclude: ["horror", "murder", "war", "holocaust", "dystopia", "violence", "abuse", "suicide"],
  },
  moving: {
    subjects: ["literary fiction", "biography", "memoir", "historical fiction"],
    fits: ["literary", "biograph", "memoir", "autobiograph", "historical fiction", "grief", "family"],
    exclude: ["humorous", "horror"],
  },
};

export type BookMood = keyof typeof BOOK_MOODS;
export function isBookMood(mood: string): mood is BookMood {
  return mood in BOOK_MOODS;
}

/** A subject the mood never deals (no horror when Cosy), whatever else fits. */
export function bookMoodExcludes(book: BookCandidate, mood: BookMood): boolean {
  const exclude = BOOK_MOODS[mood].exclude;
  return book.subjects.some((s) => exclude.some((x) => s.toLowerCase().includes(x)));
}

export function bookMoodFit(book: BookCandidate, mood: BookMood): number {
  const rule = BOOK_MOODS[mood];
  const lower = book.subjects.map((s) => s.toLowerCase());
  if (bookMoodExcludes(book, mood)) return 0;
  const hits = rule.fits.filter((f) => lower.some((s) => s.includes(f))).length;
  if (hits === 0) return 0;
  return Math.min(1, 0.5 + hits / 4);
}

/* ------------------------------------------------- length, era, energy */

/** Page bands for the length tap: short, medium, long. */
export const LENGTH_PAGES: Record<Taps["time"], [number, number]> = { 0: [0, 249], 1: [250, 449], 2: [450, 5000] };

export function fitsLength(pages: number | null, time: Taps["time"]): boolean {
  if (!pages) return time === 1; // unknown length: only as "medium"
  const [min, max] = LENGTH_PAGES[time];
  return pages >= min && pages <= max;
}

/** Mostly the last 30 years, a classic now and then: older books score a little lower. */
export function eraFit(year: number | null, now = new Date().getFullYear()): number {
  if (!year) return 0.6;
  const age = now - year;
  if (age <= 30) return 1;
  if (age <= 60) return 0.7;
  return 0.45;
}

/** At most this many books from before 1966 in one deck. */
export const MAX_CLASSICS = 2;
/** At most this many books by one author in one deck (Pratchett would fill every funny deck). */
export const MAX_PER_AUTHOR = 1;

const INTENSE = ["thriller", "suspense", "horror", "crime", "war"];
const GENTLE = ["humor", "humorous", "friendship", "domestic"];

/** Lean back: lighter and shorter; lean in: denser and more intense. */
export function bookEnergyFit(book: BookCandidate, energy: Taps["energy"]): number {
  const lower = book.subjects.map((s) => s.toLowerCase());
  const intense = INTENSE.filter((t) => lower.some((s) => s.includes(t))).length;
  const gentle = GENTLE.filter((t) => lower.some((s) => s.includes(t))).length;
  const level = intense > gentle ? 2 : gentle > intense ? 0 : 1;
  return [1, 0.45, 0][Math.abs(level - energy)];
}

/** NYT weeks on a 0–1 scale: a few weeks counts, a long run counts more, with diminishing returns. */
export function bestsellerFit(weeks: number): number {
  return Math.min(1, Math.log2(1 + weeks) / 5);
}

/**
 * Open Library tags some works with NYT list dates ("nyt:hardcover-fiction=2019-03-03").
 * Each distinct date is a week on a list: a floor for when the NYT sync has no data.
 */
export function nytWeeksFromSubjects(subjects: string[]): number {
  const dates = new Set(subjects.filter((s) => s.startsWith("nyt:")).map((s) => s.split("=")[1] ?? s));
  return dates.size;
}

/** Taste tags for books: subjects, slugged, so swipes can learn "more thrillers, fewer memoirs". */
export function bookTags(subjects: string[]): string[] {
  return [
    ...new Set(
      subjects
        .filter((s) => !s.startsWith("nyt:") && s.length < 40)
        .map((s) => `s:${s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`),
    ),
  ].slice(0, 12);
}

export function scoreBook(
  book: BookCandidate,
  taps: Taps & { mood: BookMood },
  taste: TasteProfile = NO_TASTE,
  now = new Date().getFullYear(),
): number {
  const quality = Math.min(1, Math.max(0, (bookRating(book) - 3.6) / 0.9));
  // Taste from your book swipes, over the book's subject tags, in [0, 1].
  const tags = bookTags(book.subjects);
  const affinity = tags.length ? tags.reduce((a, t) => a + (taste.tags[t] ?? 0), 0) / tags.length : 0;
  const tasteScore = (affinity + 1) / 2;
  return (
    0.3 * quality +
    0.12 * bestsellerFit(book.nytWeeks) +
    0.28 * bookMoodFit(book, taps.mood) +
    0.1 * bookEnergyFit(book, taps.energy) +
    0.1 * eraFit(book.year, now) +
    0.1 * Math.max(0, Math.min(1, tasteScore))
  );
}

export function bookEligible(book: BookCandidate, taps: Taps & { mood: BookMood }): boolean {
  return bookGate(book).ok && bookMoodFit(book, taps.mood) > 0 && fitsLength(book.pages, taps.time);
}

/** Keeps the best book per author and at most a couple of classics. Input best-first. */
export function capAuthorsAndClassics<T extends { movie: BookCandidate }>(ranked: T[], now = new Date().getFullYear()): T[] {
  const perAuthor = new Map<string, number>();
  let classics = 0;
  return ranked.filter(({ movie }) => {
    const author = (movie.authors[0] ?? "?").toLowerCase();
    if ((perAuthor.get(author) ?? 0) >= MAX_PER_AUTHOR) return false;
    const classic = movie.year !== null && now - movie.year > 60;
    if (classic && classics >= MAX_CLASSICS) return false;
    perAuthor.set(author, (perAuthor.get(author) ?? 0) + 1);
    if (classic) classics++;
    return true;
  });
}
