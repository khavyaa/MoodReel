"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireOwner } from "@/lib/session";
import { picksPage, savedPage, seenPage, turnedDownPage } from "@/lib/library-pages";
import {
  checkIn,
  completePick,
  createSavedSession,
  providersFor,
  saveProviders,
  savedTitles,
  takeBack,
  tasteFor,
  updateTitleState,
  type CheckInAnswer,
  type Media,
} from "@/lib/picks/server";
import type { DeckCard } from "@/lib/deck/build-movies";
import { seriesCard } from "@/lib/deck/build-series";
import { MAX_SAVES } from "@/lib/deck/finale";
import { withLinks } from "@/lib/adaptations/server";
import {
  bookCardsFor,
  detailsToCandidate,
  detailsToCard,
  libraryKey,
  libraryTitles,
  movieDetailsFor,
  seriesDetailsFor,
} from "@/lib/library";
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
  // No page refresh: the flow takes the card out itself and keeps your place.
}

/** Watched it: off the saved list, and it never comes back in a deck. */
export async function markSeen(media: Media, id: number) {
  const owner = await requireOwner();
  await updateTitleState(owner.id, mediaSchema.parse(media), titleId.parse(id), "seen", { saved: false, seen: true });
  // No page refresh: the flow takes the card out itself and keeps your place.
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
  // No page refresh: the stars already show the new rating, and re-rendering Saved or
  // History would drop you back at the top of a long list.
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
/** "Pick from my saved" looks at up to this many saves of the kind you chose (each needs its details fetched). */
const ALL_SAVED = 200;

export async function pickFromSaved(input: unknown): Promise<SavedPickResponse> {
  const owner = await requireOwner();
  const { media, mood, time } = savedTaps.parse(input);
  const taps = { mood, energy: 1 as const, time };
  // Every save of this kind, not only the latest ones the Saved page shows first.
  const [saved, taste, providers] = await Promise.all([
    savedTitles(owner.id, ALL_SAVED, media),
    tasteFor(owner.id, media),
    providersFor(owner.id),
  ]);
  const ids = saved.map((s) => s.id);

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

/* ------------- still on for it? (films) / still watching? (series) / still reading? (books) */

export async function answerCheckIn(
  media: Media,
  id: number,
  answer: CheckInAnswer,
  stars: number | null = null,
  options: { refresh: boolean } = { refresh: true },
) {
  const owner = await requireOwner();
  await checkIn(
    owner.id,
    mediaSchema.parse(media),
    titleId.parse(id),
    z.enum(["watching", "finished", "dropped", "not-started"]).parse(answer),
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

/** Everything about one title, for its details sheet (person pages only know titles by id). Null if the catalogue can't return it just now. */
export async function titleDetails(media: Media, id: number): Promise<DeckCard | null> {
  const owner = await requireOwner();
  const kind = mediaSchema.parse(media);
  const cards = await libraryTitles([{ media: kind, id: titleId.parse(id) }], await providersFor(owner.id));
  const card = cards.get(libraryKey(kind, id));
  if (!card) return null;
  const [linked] = await withLinks(owner.id, [card]);
  return linked;
}

/* ------------------------------------------------- more for the long flows */

const offsetSchema = z.number().int().min(0).max(10_000);

/** The next page of Saved (all, or one kind), as you near the end of its flow. */
export async function moreSaved(media: unknown, offset: unknown) {
  const owner = await requireOwner();
  return savedPage(owner.id, mediaSchema.nullable().parse(media), offsetSchema.parse(offset));
}

/** The next page of your picks. */
export async function morePicks(offset: unknown) {
  const owner = await requireOwner();
  return picksPage(owner.id, offsetSchema.parse(offset));
}

/** The next page of what you've seen or read. */
export async function moreSeen(offset: unknown) {
  const owner = await requireOwner();
  return seenPage(owner.id, offsetSchema.parse(offset));
}

/* ------------------------------------------------- undo, restore, not seen */

/** What an Undo toast takes back, and what else it puts back as it was. */
const undoSchema = z.object({
  media: mediaSchema,
  id: titleId,
  /** The action being taken back. */
  kind: z.enum(["unsaved", "seen", "disliked", "dropped", "finished", "not-started"]),
  /** Put back a film, series or book on Tonight / Watching / Reading, from this time. */
  watchingSince: z.string().datetime().nullable().optional(),
  /** It was in Saved before (the Saved list knows; elsewhere its log decides). */
  wasSaved: z.boolean().optional(),
});

/**
 * Undo, from the toast after Remove, Seen it / Read it, Not for me, Gave up /
 * Dropped, Finished or Not started yet: as if it never happened, taste included.
 */
export async function undoLibrary(input: unknown) {
  const owner = await requireOwner();
  const { media, id, kind, watchingSince, wasSaved } = undoSchema.parse(input);
  const since = watchingSince ? new Date(watchingSince) : null;
  if (kind === "not-started") {
    // Nothing was logged: it only moved from Tonight / Watching / Reading back to Saved.
    await updateTitleState(owner.id, media, id, null, { saved: false, watchingSince: since });
    return;
  }
  // Each undo reverses only what its action changed; everything else about the title stays.
  const saved = (left: { saved: boolean }) => wasSaved ?? left.saved;
  await takeBack(owner.id, media, id, [kind], {
    only: (left) =>
      kind === "unsaved"
        ? { saved: true }
        : kind === "seen"
          ? { seen: left.seen, saved: saved(left), rating: null }
          : kind === "disliked"
            ? { disliked: left.disliked, saved: saved(left) }
            : kind === "dropped"
              ? { disliked: left.disliked, watchingSince: since }
              : { seen: left.seen, rating: null, watchingSince: since },
  });
}

/** Restore, from History → Turned down: off the list, and the taste it taught is taken back. */
export async function restoreTurnedDown(media: unknown, id: unknown) {
  const owner = await requireOwner();
  await takeBack(owner.id, mediaSchema.parse(media), titleId.parse(id), ["disliked", "dropped"], { all: true });
}

/** "Not seen", from Seen & read: for a mis-tapped Seen it. Its rating goes too. */
export async function notSeen(media: unknown, id: unknown) {
  const owner = await requireOwner();
  await takeBack(owner.id, mediaSchema.parse(media), titleId.parse(id), ["seen", "finished"], { all: true, extra: { rating: null } });
}

/** The next page of what you've turned down. */
export async function moreTurnedDown(offset: unknown) {
  const owner = await requireOwner();
  return turnedDownPage(owner.id, offsetSchema.parse(offset));
}
