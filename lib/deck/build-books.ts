import "server-only";
import { composeDeck, DECK_SIZE } from "./compose";
import { applyCuration } from "./curation";
import type { DealResult, DeckCard } from "./build-movies";
import { curateWithAi } from "@/lib/ai/curate";
import { bookDescription, booksByWork, searchBooks, type BookQuery } from "@/lib/books/openlibrary";
import { nytPoolWorks, nytWeeksByWork } from "@/lib/books/nyt";
import {
  BOOK_MOODS,
  LENGTH_PAGES,
  NEVER_QUERY,
  bookEligible,
  bookTags,
  capAuthorsAndClassics,
  scoreBook,
  type BookCandidate,
  type BookMood,
} from "@/lib/books/rules";
import type { TasteProfile } from "@/lib/taste/rules";
import type { Taps } from "@/lib/taste/types";

export type BookTaps = Taps & { mood: BookMood };

/**
 * Open Library pools for one deal: the best rated, the most read, and recent
 * books, each within the length you chose and the mood's subjects.
 */
export function bookPoolQueries(taps: BookTaps): BookQuery[] {
  const base = {
    subjects: BOOK_MOODS[taps.mood].subjects,
    never: NEVER_QUERY,
    pages: LENGTH_PAGES[taps.time],
  };
  return [
    { ...base, minRatings: 20, sort: "rating", page: 1 },
    { ...base, minRatings: 20, sort: "rating", page: 2 },
    // Thinner moods (short funny books) need a lower bar to fill a deck; the gate still checks quality.
    { ...base, minRatings: 8, sort: "rating", page: 1 },
    { ...base, minRatings: 5, sort: "readinglog", page: 1 },
    { ...base, minRatings: 3, sort: "new", page: 1 },
  ];
}

const CURATE_TOP = 30;

export function bookCard(b: BookCandidate, overview = ""): DeckCard {
  return {
    media: "book",
    id: b.id,
    title: b.title,
    originalTitle: b.title,
    year: b.year,
    language: "en",
    languageLabel: "English",
    overview: overview || b.overview,
    posterPath: b.posterPath,
    backdropPath: null,
    rating: Math.round(b.voteAverage * 10) / 10,
    votes: b.voteCount,
    genreIds: [],
    genres: b.subjects.filter((s) => !s.startsWith("nyt:") && s.length < 32).slice(0, 4),
    runtime: null,
    directors: b.authors,
    cast: [],
    streamingOn: [],
    gate: null,
    trailerKey: null,
    series: null,
    book: {
      authors: b.authors,
      pages: b.pages,
      nytWeeks: b.nytWeeks,
      subjects: b.subjects.filter((s) => !s.startsWith("nyt:")).slice(0, 8),
      tags: bookTags(b.subjects),
    },
  };
}

/** Adds NYT weeks from the synced lists (when there are any) to each candidate. */
export async function withNytWeeks(books: BookCandidate[]): Promise<BookCandidate[]> {
  const weeks = await nytWeeksByWork(books.map((b) => b.id)).catch(() => new Map<number, number>());
  return books.map((b) => ({ ...b, nytWeeks: Math.max(b.nytWeeks, weeks.get(b.id) ?? 0) }));
}

export async function buildBookDeck(
  taps: BookTaps,
  { exclude, taste, seed }: { exclude: Set<number>; taste: TasteProfile; seed: number },
): Promise<DealResult> {
  const results = await Promise.allSettled(bookPoolQueries(taps).map((q) => searchBooks(q)));
  const pool = new Map<number, BookCandidate>();
  for (const r of results) if (r.status === "fulfilled") for (const b of r.value) pool.set(b.id, b);
  if (pool.size === 0 && results.every((r) => r.status === "rejected")) {
    throw (results[0] as PromiseRejectedResult).reason ?? new Error("Open Library returned nothing.");
  }

  // Lasting NYT bestsellers join the pool even with few Open Library ratings.
  const nytWorks = await nytPoolWorks().catch(() => new Map<number, number>());
  const missing = [...nytWorks.keys()].filter((id) => !pool.has(id) && !exclude.has(id));
  if (missing.length) {
    const found = await booksByWork(missing.slice(0, 120)).catch(() => new Map<number, BookCandidate>());
    for (const b of found.values()) pool.set(b.id, b);
  }

  const candidates = (await withNytWeeks([...pool.values()])).filter((b) => !exclude.has(b.id) && bookEligible(b, taps));
  const ranked = candidates
    .map((movie) => ({ movie, score: scoreBook(movie, taps, taste) }))
    .sort((a, b) => b.score - a.score);
  const scored = capAuthorsAndClassics(ranked);

  const top = scored.slice(0, CURATE_TOP).map((s) => s.movie);
  const approved = await curateWithAi(taps, top, "book");
  const deck = composeDeck(applyCuration(scored, approved, new Set(top.map((m) => m.id))), { size: DECK_SIZE, seed });

  const descriptions = await Promise.all(deck.map((b) => bookDescription(b.id)));
  return {
    cards: deck.map((b, i) => bookCard(b, descriptions[i])),
    missingLanguages: [],
    curatedByAi: approved !== null,
  };
}
