"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireOwner } from "@/lib/session";
import {
  answerFollowUp,
  checkIn,
  completePick,
  createSavedSession,
  providersFor,
  saveProviders,
  savedTitles,
  tasteFor,
  updateTitleState,
  type CheckInAnswer,
  type FollowUpAnswer,
  type Media,
} from "@/lib/picks/server";
import type { DeckCard } from "@/lib/deck/build-movies";
import { seriesCard } from "@/lib/deck/build-series";
import { MAX_SAVES } from "@/lib/deck/finale";
import { withLinks } from "@/lib/adaptations/server";
import { bookCardsFor, detailsToCandidate, detailsToCard, movieDetailsFor, seriesDetailsFor } from "@/lib/library";
import { withNytWeeks } from "@/lib/deck/build-books";
import { booksByWork } from "@/lib/books/openlibrary";
import { fitsLength, scoreBook, type BookCandidate } from "@/lib/books/rules";
import { MEDIA, type MoodId } from "@/lib/moods";
import { RUNTIME_LIMIT, scoreMovie } from "@/lib/taste/rules";
import { fitsCommitment, scoreSeries } from "@/lib/taste/series-rules";
import { writeWhy } from "@/lib/ai/why";

const titleId = z.number().int().positive();
const mediaSchema = z.enum(["movie", "series", "book"]);
const starsSchema = z.number().int().min(1).max(5).nullable();

/** Take a title off the saved list without saying you've seen it. */
export async function removeSaved(media: Media, id: number) {
  const owner = await requireOwner();
  await updateTitleState(owner.id, mediaSchema.parse(media), titleId.parse(id), "unsaved", { saved: false });
  refresh();
}

/** Watched it: off the saved list, and it never comes back in a deck. */
export async function markSeen(media: Media, id: number) {
  const owner = await requireOwner();
  await updateTitleState(owner.id, mediaSchema.parse(media), titleId.parse(id), "seen", { saved: false, seen: true });
  refresh();
}

/**
 * Rate a past pick, 1 to 5 stars (stored as 2–10 to match the 1–10 column),
 * or clear it with null. Rating implies you watched it. Not logged as an
 * action, so re-rating never shifts your taste.
 */
export async function rateTitle(media: Media, id: number, stars: number | null) {
  const owner = await requireOwner();
  const value = starsSchema.parse(stars);
  await updateTitleState(owner.id, mediaSchema.parse(media), titleId.parse(id), null, {
    rating: value === null ? null : value * 2,
    ...(value === null ? {} : { seen: true }),
  });
  refresh();
}

/* ---------------------------------------------------------- pick from saved */

const level = z.union([z.literal(0), z.literal(1), z.literal(2)]);
const savedTaps = z.object({ media: mediaSchema, mood: z.enum(MEDIA.movies.moods), time: level });

export type SavedPickResponse =
  | {
      ok: true;
      sessionId: string;
      cards: DeckCard[];
      taps: { mood: MoodId; energy: 1; time: 0 | 1 | 2 };
      /** Set when only one title fit: it's already tonight's pick. */
      why: string | null;
    }
  | { ok: false; error: string };

/**
 * Skips the deck: the saved films (or series) that best fit the mood, and the
 * time or commitment you chose, go straight into the head-to-head.
 */
export async function pickFromSaved(input: unknown): Promise<SavedPickResponse> {
  const owner = await requireOwner();
  const { media, mood, time } = savedTaps.parse(input);
  const taps = { mood, energy: 1 as const, time };
  const [saved, taste, providers] = await Promise.all([
    savedTitles(owner.id),
    tasteFor(owner.id, media),
    providersFor(owner.id),
  ]);
  const ids = saved.filter((s) => s.media === media).map((s) => s.id);

  let best: DeckCard[];
  if (media === "book") {
    const bookMood = z.enum(MEDIA.books.moods).parse(mood);
    const cards = await bookCardsFor(ids);
    const found = await booksByWork(ids).catch(() => new Map<number, BookCandidate>());
    const books = await withNytWeeks([...found.values()]);
    best = books
      .filter((b) => fitsLength(b.pages, time))
      .map((b) => ({ b, score: scoreBook(b, { ...taps, mood: bookMood }, taste) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_SAVES)
      .flatMap(({ b }) => cards.get(b.id) ?? []);
  } else if (media === "movie") {
    const details = await movieDetailsFor(ids);
    const limit = RUNTIME_LIMIT[time];
    best = [...details.values()]
      .filter((d) => limit === null || d.runtime === null || d.runtime <= limit)
      .map((d) => ({ d, score: scoreMovie(detailsToCandidate(d, providers), taps, taste) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_SAVES)
      .map(({ d }) => detailsToCard(d, providers));
  } else {
    const seriesMood = z.enum(MEDIA.series.moods).parse(mood);
    const details = await seriesDetailsFor(ids);
    best = [...details.values()]
      .filter((d) => fitsCommitment(d.facts, time))
      .map((d) => ({ d, score: scoreSeries(d.candidate, { ...taps, mood: seriesMood }, taste, d.facts) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_SAVES)
      .map(({ d }) => seriesCard(d, providers));
  }
  best = await withLinks(owner.id, best);
  if (best.length === 0) {
    return {
      ok: false,
      error:
        media === "movie"
          ? "None of your saved films fit in that time. Try a longer slot."
          : media === "series"
            ? "None of your saved series fit that commitment. Try another."
            : "None of your saved books are that length. Try another.",
    };
  }

  const sessionId = await createSavedSession(owner.id, media, taps, best.map((c) => c.id));
  if (best.length > 1) return { ok: true, sessionId, cards: best, taps, why: null };

  // Only one fits: no head-to-head, it's the pick.
  const [only] = best;
  const why = await writeWhy({
    ...only,
    mood,
    energy: taps.energy,
    beat: 0,
    seasons: only.series?.seasons ?? null,
    firstSeasonEpisodes: only.series?.firstSeasonEpisodes ?? null,
    book: only.book,
  });
  await completePick(owner.id, sessionId, { ...only, tags: only.book?.tags }, why);
  return { ok: true, sessionId, cards: best, taps, why: why.text };
}

/* -------------------------------------------------- did you watch it? (films) */

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
    starsSchema.parse(stars),
  );
  if (options.refresh) refresh();
}

/* ------------------------- still watching? (series) / still reading? (books) */

export async function answerCheckIn(
  media: "series" | "book",
  id: number,
  answer: CheckInAnswer,
  stars: number | null = null,
  options: { refresh: boolean } = { refresh: true },
) {
  const owner = await requireOwner();
  await checkIn(
    owner.id,
    z.enum(["series", "book"]).parse(media),
    titleId.parse(id),
    z.enum(["watching", "finished", "dropped"]).parse(answer),
    starsSchema.parse(stars),
  );
  if (options.refresh) refresh();
}

/* --------------------------------------------------------------- services */

export async function saveServices(providers: number[]) {
  const owner = await requireOwner();
  await saveProviders(owner.id, z.array(z.number().int().positive()).max(60).parse([...new Set(providers)]));
  refresh();
}
