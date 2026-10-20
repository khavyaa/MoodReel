"use server";

import { z } from "zod";
import { requireOwner } from "@/lib/session";
import { dislikeOutsideDeck, markSeenOutsideDeck, statesFor, updateTitleState, type Media } from "@/lib/picks/server";
import { mostVotedMovies, searchMovies } from "@/lib/tmdb/movies";
import { mostVotedShows, searchShows } from "@/lib/tmdb/series";
import { mostReadBooks, searchBookTitles } from "@/lib/books/openlibrary";
import { bookTags, type BookCandidate } from "@/lib/books/rules";
import type { MovieCandidate } from "@/lib/taste/types";

/*
 * Adding what you'd watched or read before MoodReel: search any title and mark
 * it, or go through a stack of well-known ones. Marking counts like the swipe
 * (seen / not for me), so it teaches taste and keeps the title out of decks.
 */

const mediaSchema = z.enum(["movie", "series", "book"]);

export type AddCandidate = {
  media: Media;
  id: number;
  title: string;
  year: number | null;
  posterPath: string | null;
  /** An author, for books. */
  by: string | null;
  language: string;
  genreIds: number[];
  tags: string[];
  /** What you've already said about it, if anything. */
  state: "seen" | "saved" | "disliked" | null;
  /** Your rating, 1–5 stars. */
  stars: number | null;
};

function toAdd(media: Media, c: MovieCandidate | BookCandidate): Omit<AddCandidate, "state" | "stars"> {
  const book = media === "book" ? (c as BookCandidate) : null;
  return {
    media,
    id: c.id,
    title: c.title,
    year: c.year,
    posterPath: c.posterPath,
    by: book?.authors[0] ?? null,
    language: c.language,
    genreIds: c.genreIds,
    tags: book ? bookTags(book.subjects) : [],
  };
}

async function withStates(userId: string, media: Media, found: (MovieCandidate | BookCandidate)[]): Promise<AddCandidate[]> {
  const unique = [...new Map(found.map((c) => [c.id, c])).values()];
  const states = await statesFor(userId, media, unique.map((c) => c.id));
  return unique.map((c) => {
    const s = states.get(c.id);
    const state = s?.seen ? "seen" : s?.disliked ? "disliked" : s?.saved ? "saved" : null;
    return { ...toAdd(media, c), state, stars: s?.rating ? Math.round(s.rating / 2) : null };
  });
}

/** Titles matching a search, each with what you've already said about it. */
export async function findTitles(media: Media, query: unknown): Promise<AddCandidate[]> {
  const owner = await requireOwner();
  const kind = mediaSchema.parse(media);
  const q = z.string().trim().min(2).max(100).parse(query);
  try {
    const found = kind === "movie" ? await searchMovies(q) : kind === "series" ? await searchShows(q) : await searchBookTitles(q);
    return withStates(owner.id, kind, found);
  } catch {
    return [];
  }
}

/** Languages the stack mixes in, English first: the most-watched in each take turns. */
const STACK_LANGUAGES = { movie: ["en", "hi", "ta", "ml"], series: ["en", "hi"] } as const;

/**
 * Well-known titles you haven't said anything about yet, for "Have you seen
 * these?": the most-voted films and series (English, with your other languages
 * mixed in) or the most-read books.
 */
export async function haveYouSeen(media: Media, page: unknown): Promise<AddCandidate[]> {
  const owner = await requireOwner();
  const kind = mediaSchema.parse(media);
  const n = z.number().int().min(1).max(50).parse(page);
  let found: (MovieCandidate | BookCandidate)[] = [];
  try {
    if (kind === "book") found = await mostReadBooks(n);
    else {
      const languages = STACK_LANGUAGES[kind];
      const lists = await Promise.all(
        languages.map((l) => (kind === "movie" ? mostVotedMovies(l, n) : mostVotedShows(l, n)).catch(() => [])),
      );
      // Two English for each of the others, in turn.
      const [english, ...others] = lists;
      for (let i = 0; found.length < english.length + others.flat().length; i++) {
        if (english[2 * i]) found.push(english[2 * i]);
        if (english[2 * i + 1]) found.push(english[2 * i + 1]);
        for (const list of others) if (list[i]) found.push(list[i]);
        if (i > 40) break;
      }
    }
  } catch {
    return [];
  }
  return (await withStates(owner.id, kind, found)).filter((c) => c.state === null);
}

const titleSchema = z.object({
  id: z.number().int().positive(),
  language: z.string().min(2).max(3),
  genreIds: z.array(z.number().int()).max(20),
  tags: z.array(z.string().max(60)).max(12).optional(),
});

/**
 * Seen it / Read it (with optional stars), or Not for me, for a title you
 * didn't meet in a deck. Counts like the swipe; stars land on the title.
 */
export async function markKnown(media: Media, title: unknown, answer: "seen" | "disliked", stars: number | null) {
  const owner = await requireOwner();
  const kind = mediaSchema.parse(media);
  const t = titleSchema.parse(title);
  const rating = z.number().int().min(1).max(5).nullable().parse(stars);
  if (z.enum(["seen", "disliked"]).parse(answer) === "disliked") {
    await dislikeOutsideDeck(owner.id, kind, t);
    return;
  }
  await markSeenOutsideDeck(owner.id, kind, t);
  if (rating !== null) await updateTitleState(owner.id, kind, t.id, null, { rating: rating * 2 });
}
