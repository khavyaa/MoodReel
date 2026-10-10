"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireOwner } from "@/lib/session";
import {
  answerFollowUp,
  completePick,
  createSavedSession,
  providersFor,
  saveProviders,
  savedMovieIds,
  tasteFor,
  updateMovieState,
  type FollowUpAnswer,
} from "@/lib/picks/server";
import type { DeckCard } from "@/lib/deck/build-movies";
import { MAX_SAVES } from "@/lib/deck/finale";
import { detailsToCandidate, detailsToCard, movieDetailsFor } from "@/lib/library";
import { MEDIA, type MoodId } from "@/lib/moods";
import { RUNTIME_LIMIT, scoreMovie } from "@/lib/taste/rules";
import { writeWhy } from "@/lib/ai/why";

const movieId = z.number().int().positive();

/** Take a film off the saved list without saying you've seen it. */
export async function removeSaved(id: number) {
  const owner = await requireOwner();
  await updateMovieState(owner.id, movieId.parse(id), "unsaved", { saved: false });
  refresh();
}

/** Watched it: off the saved list, and it never comes back in a deck. */
export async function markSeen(id: number) {
  const owner = await requireOwner();
  await updateMovieState(owner.id, movieId.parse(id), "seen", { saved: false, seen: true });
  refresh();
}

/**
 * Rate a past pick, 1 to 5 stars (stored as 2–10 to match the 1–10 column),
 * or clear it with null. Rating implies you watched it. Not logged as an
 * action, so re-rating never shifts your taste.
 */
export async function rateMovie(id: number, stars: number | null) {
  const owner = await requireOwner();
  const value = z.number().int().min(1).max(5).nullable().parse(stars);
  await updateMovieState(owner.id, movieId.parse(id), null, {
    rating: value === null ? null : value * 2,
    ...(value === null ? {} : { seen: true }),
  });
  refresh();
}

/* ---------------------------------------------------------- pick from saved */

const savedTaps = z.object({
  mood: z.enum(MEDIA.movies.moods),
  time: z.union([z.literal(0), z.literal(1), z.literal(2)]),
});

export type SavedPickResponse =
  | {
      ok: true;
      sessionId: string;
      cards: DeckCard[];
      taps: { mood: MoodId; energy: 1; time: 0 | 1 | 2 };
      /** Set when only one film fit: it's already tonight's pick. */
      why: string | null;
    }
  | { ok: false; error: string };

/**
 * Skips the deck: the saved films that best fit the mood (and fit the time you
 * have) go straight into the head-to-head.
 */
export async function pickFromSaved(input: unknown): Promise<SavedPickResponse> {
  const owner = await requireOwner();
  const { mood, time } = savedTaps.parse(input);
  const taps = { mood, energy: 1 as const, time };
  const [saved, taste, providers] = await Promise.all([
    savedMovieIds(owner.id),
    tasteFor(owner.id),
    providersFor(owner.id),
  ]);
  const details = await movieDetailsFor(saved.map((s) => s.id));
  const limit = RUNTIME_LIMIT[time];
  const fits = [...details.values()].filter((d) => limit === null || d.runtime === null || d.runtime <= limit);
  if (fits.length === 0) {
    return { ok: false, error: "None of your saved films fit in that time. Try a longer slot." };
  }
  const best = fits
    .map((d) => ({ d, score: scoreMovie(detailsToCandidate(d, providers), taps, taste) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_SAVES)
    .map(({ d }) => detailsToCard(d, providers));
  const sessionId = await createSavedSession(owner.id, taps, best.map((c) => c.id));
  if (best.length > 1) return { ok: true, sessionId, cards: best, taps, why: null };

  // Only one fits: no head-to-head, it's the pick.
  const [only] = best;
  const why = await writeWhy({
    ...only,
    languageLabel: only.languageLabel,
    mood,
    energy: taps.energy,
    beat: 0,
  });
  await completePick(owner.id, sessionId, only, why);
  return { ok: true, sessionId, cards: best, taps, why: why.text };
}

/* -------------------------------------------------------- did you watch it? */

/** `refresh: false` from the start-screen card, which shows its own confirmation and would vanish on refresh. */
export async function answerWatched(
  sessionId: string,
  answer: FollowUpAnswer,
  stars: number | null = null,
  options: { refresh: boolean } = { refresh: true },
) {
  const owner = await requireOwner();
  await answerFollowUp(
    owner.id,
    z.string().uuid().parse(sessionId),
    z.enum(["watched", "later", "skipped"]).parse(answer),
    z.number().int().min(1).max(5).nullable().parse(stars),
  );
  if (options.refresh) refresh();
}

/* --------------------------------------------------------------- services */

export async function saveServices(providers: number[]) {
  const owner = await requireOwner();
  await saveProviders(owner.id, z.array(z.number().int().positive()).max(60).parse([...new Set(providers)]));
  refresh();
}
