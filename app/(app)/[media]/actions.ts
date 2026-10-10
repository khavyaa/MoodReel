"use server";

import { z } from "zod";
import { requireOwner } from "@/lib/session";
import { buildMovieDeck, type DeckCard } from "@/lib/deck/build-movies";
import { TmdbError } from "@/lib/tmdb/client";
import {
  completePick,
  createMovieSession,
  handledMovieIds,
  markSessionEmpty,
  providersFor,
  recordSwipe,
  tasteFor,
  undoSwipe,
} from "@/lib/picks/server";
import { writeWhy } from "@/lib/ai/why";
import { MEDIA } from "@/lib/moods";

const tapsSchema = z.object({
  mood: z.enum(MEDIA.movies.moods),
  energy: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  time: z.union([z.literal(0), z.literal(1), z.literal(2)]),
});

const titleSchema = z.object({
  id: z.number().int().positive(),
  language: z.string().min(2).max(3),
  genreIds: z.array(z.number().int()).max(20),
});

export type DealResponse =
  | { ok: true; sessionId: string; cards: DeckCard[]; missingLanguages: string[] }
  | { ok: false; error: string };

export async function dealMovies(input: unknown): Promise<DealResponse> {
  const owner = await requireOwner();
  const taps = tapsSchema.parse(input);
  try {
    const [exclude, taste, providers] = await Promise.all([
      handledMovieIds(owner.id),
      tasteFor(owner.id),
      providersFor(owner.id),
    ]);
    const seed = Date.now() % 100_000;
    const { cards, missingLanguages, curatedByAi } = await buildMovieDeck(taps, { exclude, taste, seed, providers });
    console.info(`[moodreel] dealt ${cards.length} cards (${curatedByAi ? "AI-curated" : "rules only"})`);
    const sessionId = await createMovieSession(owner.id, taps, cards.map((c) => c.id));
    return { ok: true, sessionId, cards, missingLanguages };
  } catch (error) {
    console.error("[moodreel] deal failed", error);
    if (error instanceof TmdbError && error.status === 0 && !error.retryable) {
      return { ok: false, error: "Movie data isn't set up on the server (TMDb token missing)." };
    }
    return { ok: false, error: "Couldn't reach the movie database just now. Try again in a moment." };
  }
}

const swipeSchema = z.enum(["saved", "skipped", "seen", "disliked"]);

export async function swipeMovie(sessionId: string, title: unknown, action: z.infer<typeof swipeSchema>) {
  const owner = await requireOwner();
  z.string().uuid().parse(sessionId);
  await recordSwipe(owner.id, sessionId, titleSchema.parse(title), swipeSchema.parse(action));
}

/** Takes back your last swipe on this card. */
export async function undoMovieSwipe(sessionId: string, movieId: number) {
  const owner = await requireOwner();
  await undoSwipe(owner.id, z.string().uuid().parse(sessionId), z.number().int().positive().parse(movieId));
}

export async function noSavesThisTime(sessionId: string) {
  const owner = await requireOwner();
  await markSessionEmpty(owner.id, z.string().uuid().parse(sessionId));
}

const pickSchema = titleSchema.extend({
  title: z.string(),
  rating: z.number(),
  votes: z.number(),
  runtime: z.number().nullable(),
  languageLabel: z.string(),
  gate: z.enum(["crime/thriller", "acclaimed"]).nullable(),
  streamingOn: z.array(z.string()),
  directors: z.array(z.string()),
  overview: z.string().max(2000),
});

export async function pickMovie(
  sessionId: string,
  winner: unknown,
  context: { mood: string; energy: number; beat: number },
): Promise<{ why: string }> {
  const owner = await requireOwner();
  z.string().uuid().parse(sessionId);
  const w = pickSchema.parse(winner);
  const taps = tapsSchema.pick({ mood: true, energy: true }).parse(context);
  const why = await writeWhy({ ...w, mood: taps.mood, energy: taps.energy, beat: Math.max(0, context.beat | 0) });
  await completePick(owner.id, sessionId, w, why);
  return { why: why.text };
}
