"use server";

import { z } from "zod";
import { requireOwner } from "@/lib/session";
import { buildMovieDeck, type DeckCard } from "@/lib/deck/build-movies";
import { buildSeriesDeck } from "@/lib/deck/build-series";
import { buildBookDeck } from "@/lib/deck/build-books";
import { TmdbError } from "@/lib/tmdb/client";
import {
  abandonDeck,
  resumableDeck,
  markSeenOutsideDeck,
  completePick,
  createDeckSession,
  handledIds,
  markSessionEmpty,
  providersFor,
  recordSwipe,
  tasteFor,
  undoSwipe,
  type Media,
  type SwipeAction,
} from "@/lib/picks/server";
import { writeWhy } from "@/lib/ai/why";
import { MEDIA } from "@/lib/moods";
import { peopleFilterFor } from "@/lib/people/server";
import { buildPersonDeck, followedWork } from "@/lib/people/works";
import type { BookCandidate } from "@/lib/books/rules";
import { parsePersonKey, personKey } from "@/lib/people/types";
import { adaptFilterFor, screenCandidates, withLinks } from "@/lib/adaptations/server";
import { libraryKey, libraryTitles } from "@/lib/library";
import { listBySlug } from "@/lib/lists/catalog";
import { followedListTitles } from "@/lib/lists/server";
import { buildListDeck, ListNotLoaded } from "@/lib/lists/deck";
import { booksByWork } from "@/lib/books/openlibrary";

/** A title on a list you follow ranks this much higher (and skips the "everyone has seen it" markdown). */
const LIST_BOOST = 0.1;
/** At most this many unseen titles from lists you follow join one deal's pool. */
const LIST_EXTRAS = 12;
import { NO_ADAPT } from "@/lib/adaptations/rules";

const level = z.union([z.literal(0), z.literal(1), z.literal(2)]);
const movieTaps = z.object({ mood: z.enum(MEDIA.movies.moods), energy: level, time: level });
const seriesTaps = z.object({ mood: z.enum(MEDIA.series.moods), energy: level, time: level });
const bookTaps = z.object({ mood: z.enum(MEDIA.books.moods), energy: level, time: level });
const mediaSchema = z.enum(["movie", "series", "book"]);

const titleSchema = z.object({
  id: z.number().int().positive(),
  language: z.string().min(2).max(3),
  genreIds: z.array(z.number().int()).max(20),
  /** Books: subject tags for taste. */
  tags: z.array(z.string().max(60)).max(12).optional(),
});

export type DealResponse =
  | { ok: true; sessionId: string; cards: DeckCard[]; missingLanguages: string[] }
  | { ok: false; error: string };

/**
 * Deals a deck of films, series or books for these taps; with a person, only
 * from their work; with "adaptations only", only films or series of books.
 */
export async function deal(
  media: Media,
  input: unknown,
  withPerson?: string | null,
  adaptationsOnly?: boolean,
  fromList?: string | null,
): Promise<DealResponse> {
  const owner = await requireOwner();
  mediaSchema.parse(media);
  const only = z.boolean().optional().parse(adaptationsOnly) === true && media !== "book";
  const listSlug = z.string().max(80).nullish().parse(fromList) ?? null;
  if (listSlug && !listBySlug(listSlug)) throw new z.ZodError([]);
  const source = media === "book" ? "Open Library" : "TMDb";
  try {
    const [exclude, taste, providers, people, adapt, onLists] = await Promise.all([
      handledIds(owner.id, media),
      tasteFor(owner.id, media),
      providersFor(owner.id),
      peopleFilterFor(owner.id),
      adaptFilterFor(owner.id, media, only).catch((error) => {
        console.error("[moodreel] adaptation links unavailable", error);
        return { filter: { ...NO_ADAPT, only }, extraIds: [] as number[] };
      }),
      followedListTitles(owner.id, media).catch(() => new Map<number, string>()),
    ]);
    const seed = Date.now() % 100_000;
    // Titles on lists you follow rank a little higher, like films of books you've read
    // (and share their cap per deck), and a few unseen ones join the pool.
    const bonus = new Map(adapt.filter.bonus);
    for (const id of onLists.keys()) bonus.set(id, Math.max(bonus.get(id) ?? 0, LIST_BOOST));
    const listIds = [...onLists.keys()].filter((id) => !exclude.has(id)).slice(0, LIST_EXTRAS);
    const [extra, adaptExtra, listBooks] = await Promise.all([
      followedWork(media, people.follow).catch(() => []),
      media === "book"
        ? []
        : screenCandidates(media, [...adapt.extraIds, ...listIds].filter((id) => !exclude.has(id)), providers).catch(() => []),
      media === "book" ? booksByWork(listIds).then((m) => [...m.values()]).catch(() => []) : [],
    ]);
    const options = { exclude, taste, seed, providers, people, adapt: { ...adapt.filter, bonus }, adaptExtra };
    const taps = media === "movie" ? movieTaps.parse(input) : media === "series" ? seriesTaps.parse(input) : bookTaps.parse(input);
    const person = parsePersonKey(withPerson);
    if (withPerson && !person) throw new z.ZodError([]);
    const dealt = listSlug
      ? await buildListDeck(media, taps, listSlug, { exclude, taste, providers })
      : person
        ? await buildPersonDeck(media, taps, person, { exclude, taste, providers, followed: people.follow.has(personKey(person)) })
        : media === "movie"
          ? await buildMovieDeck(movieTaps.parse(input), { ...options, extra })
          : media === "series"
            ? await buildSeriesDeck(seriesTaps.parse(input), { ...options, extra })
            : await buildBookDeck(bookTaps.parse(input), { ...options, extra: [...(extra as BookCandidate[]), ...listBooks] });
    const { missingLanguages, curatedByAi } = dealt;
    const cards = (await withLinks(owner.id, dealt.cards)).map((c) => ({ ...c, listName: listSlug ? null : (onLists.get(c.id) ?? null) }));
    console.info(
      `[moodreel] dealt ${cards.length} ${media} cards${person ? ` from ${personKey(person)}` : ""}${listSlug ? ` from list ${listSlug}` : ""}${only ? " (adaptations only)" : ""}, ${cards.filter((c) => c.link).length} linked, ${cards.filter((c) => c.listName).length} on followed lists (${curatedByAi ? "AI-curated" : "rules only"})`,
    );
    const sessionId = await createDeckSession(owner.id, media, taps, cards.map((c) => c.id));
    return { ok: true, sessionId, cards, missingLanguages };
  } catch (error) {
    if (error instanceof z.ZodError) throw error;
    if (error instanceof ListNotLoaded) {
      return { ok: false, error: "That list hasn't loaded yet, so there's nothing to deal from it. Try again in a moment, or deal without it." };
    }
    console.error("[moodreel] deal failed", error);
    if (error instanceof TmdbError && error.status === 0 && !error.retryable) {
      return { ok: false, error: "Movie and series data isn't set up on the server (TMDb token missing)." };
    }
    return { ok: false, error: `Couldn't reach ${source} just now. Try again in a moment.` };
  }
}

/** "I've read it" for a film's book (or "I've seen it" for a book's film), from the pick screen. */
export async function knowIt(media: Media, title: unknown) {
  const owner = await requireOwner();
  await markSeenOutsideDeck(owner.id, mediaSchema.parse(media), titleSchema.parse(title));
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
  book: z
    .object({ authors: z.array(z.string()).max(5), pages: z.number().int().nullable(), nytWeeks: z.number().int() })
    .nullable()
    .optional(),
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

/* ----------------------------------------------------------------- resume */

export type ResumeOffer = { sessionId: string; mood: string; dealt: number; saves: number; total: number };

/** Whether there's an unfinished deck from the last day to offer on the start screen. Cheap: no catalogue calls. */
export async function resumeOffer(media: Media): Promise<ResumeOffer | null> {
  const owner = await requireOwner();
  const deck = await resumableDeck(owner.id, mediaSchema.parse(media));
  if (!deck) return null;
  return {
    sessionId: deck.sessionId,
    mood: deck.taps.mood,
    dealt: deck.actions.length,
    saves: deck.actions.filter((a) => a === "saved").length,
    total: deck.ids.length,
  };
}

export type ResumeResponse =
  | { ok: true; sessionId: string; taps: { mood: string; energy: 0 | 1 | 2; time: 0 | 1 | 2 }; cards: DeckCard[]; actions: SwipeAction[] }
  | { ok: false; error: string };

/** The unfinished deck itself, its cards fetched again, and where you were in it. */
export async function resumeDeck(media: Media): Promise<ResumeResponse> {
  const owner = await requireOwner();
  mediaSchema.parse(media);
  const deck = await resumableDeck(owner.id, media);
  if (!deck) return { ok: false, error: "That deck has expired. Deal a new one." };
  const found = await withLinks(
    owner.id,
    [...(await libraryTitles(deck.ids.map((id) => ({ media, id })), await providersFor(owner.id))).values()],
  );
  const byKey = new Map(found.map((c) => [libraryKey(c.media, c.id), c]));
  const cards = deck.ids.flatMap((id) => byKey.get(libraryKey(media, id)) ?? []);
  // Positions in the deck must line up with the swipes, so a card that can't load means no resume this time.
  if (cards.length !== deck.ids.length) {
    return { ok: false, error: `Couldn't load that deck from ${media === "book" ? "Open Library" : "TMDb"} just now. Try again, or deal a new one.` };
  }
  return {
    ok: true,
    sessionId: deck.sessionId,
    taps: { mood: deck.taps.mood, energy: level.parse(deck.taps.energy), time: level.parse(deck.taps.time) },
    cards,
    actions: deck.actions,
  };
}

/** "Start again": forget the unfinished deck. */
export async function abandon(sessionId: string) {
  const owner = await requireOwner();
  await abandonDeck(owner.id, z.string().uuid().parse(sessionId));
}
