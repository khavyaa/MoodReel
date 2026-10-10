"use server";

import { z } from "zod";
import { requireOwner } from "@/lib/session";
import { buildMovieDeck, type DeckCard } from "@/lib/deck/build-movies";
import { buildSeriesDeck } from "@/lib/deck/build-series";
import { TmdbError } from "@/lib/tmdb/client";
import {
  completePick,
  createDeckSession,
  handledIds,
  markSessionEmpty,
  providersFor,
  recordSwipe,
  tasteFor,
  undoSwipe,
  type Media,
} from "@/lib/picks/server";
import { writeWhy } from "@/lib/ai/why";
import { MEDIA } from "@/lib/moods";

const level = z.union([z.literal(0), z.literal(1), z.literal(2)]);
const movieTaps = z.object({ mood: z.enum(MEDIA.movies.moods), energy: level, time: level });
const seriesTaps = z.object({ mood: z.enum(MEDIA.series.moods), energy: level, time: level });
const mediaSchema = z.enum(["movie", "series"]);

const titleSchema = z.object({
  id: z.number().int().positive(),
  language: z.string().min(2).max(3),
  genreIds: z.array(z.number().int()).max(20),
});

export type DealResponse =
  | { ok: true; sessionId: string; cards: DeckCard[]; missingLanguages: string[] }
  | { ok: false; error: string };

/** Deals a deck of films or series for these taps. */
export async function deal(media: Media, input: unknown): Promise<DealResponse> {
  const owner = await requireOwner();
  mediaSchema.parse(media);
  const noun = media === "movie" ? "movie" : "TV";
  try {
    const [exclude, taste, providers] = await Promise.all([
      handledIds(owner.id, media),
      tasteFor(owner.id, media),
      providersFor(owner.id),
    ]);
    const seed = Date.now() % 100_000;
    const options = { exclude, taste, seed, providers };
    const taps = media === "movie" ? movieTaps.parse(input) : seriesTaps.parse(input);
    const { cards, missingLanguages, curatedByAi } =
      media === "movie"
        ? await buildMovieDeck(movieTaps.parse(input), options)
        : await buildSeriesDeck(seriesTaps.parse(input), options);
    console.info(`[moodreel] dealt ${cards.length} ${media} cards (${curatedByAi ? "AI-curated" : "rules only"})`);
    const sessionId = await createDeckSession(owner.id, media, taps, cards.map((c) => c.id));
    return { ok: true, sessionId, cards, missingLanguages };
  } catch (error) {
    if (error instanceof z.ZodError) throw error;
    console.error("[moodreel] deal failed", error);
    if (error instanceof TmdbError && error.status === 0 && !error.retryable) {
      return { ok: false, error: `${noun === "TV" ? "Series" : "Movie"} data isn't set up on the server (TMDb token missing).` };
    }
    return { ok: false, error: `Couldn't reach the ${noun} database just now. Try again in a moment.` };
  }
}

const swipeSchema = z.enum(["saved", "skipped", "seen", "disliked"]);

export async function swipe(sessionId: string, title: unknown, action: z.infer<typeof swipeSchema>) {
  const owner = await requireOwner();
  z.string().uuid().parse(sessionId);
  await recordSwipe(owner.id, sessionId, titleSchema.parse(title), swipeSchema.parse(action));
}

/** Takes back your last swipe on this card. */
export async function undo(sessionId: string, titleId: number) {
  const owner = await requireOwner();
  await undoSwipe(owner.id, z.string().uuid().parse(sessionId), z.number().int().positive().parse(titleId));
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
  seasons: z.number().int().nullable().optional(),
  firstSeasonEpisodes: z.number().int().nullable().optional(),
});

export async function pick(
  sessionId: string,
  winner: unknown,
  context: { mood: string; energy: number; beat: number },
): Promise<{ why: string }> {
  const owner = await requireOwner();
  z.string().uuid().parse(sessionId);
  const w = pickSchema.parse(winner);
  const mood = z.enum(MEDIA.movies.moods).parse(context.mood);
  const energy = level.parse(context.energy);
  const why = await writeWhy({ ...w, mood, energy, beat: Math.max(0, context.beat | 0) });
  await completePick(owner.id, sessionId, w, why);
  return { why: why.text };
}
