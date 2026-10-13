import "server-only";
import { and, eq, inArray, isNotNull, or } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { adaptations, titleStates } from "@/lib/db/schema";
import { booksByWork, findWork } from "@/lib/books/openlibrary";
import { bookTags } from "@/lib/books/rules";
import type { DeckCard } from "@/lib/deck/build-movies";
import { detailsToCandidate } from "@/lib/library";
import { statesFor, type Media } from "@/lib/picks/server";
import { getMovieDetails } from "@/lib/tmdb/movies";
import { getSeriesDetails } from "@/lib/tmdb/series";
import type { MovieCandidate } from "@/lib/taste/types";
import { bonusByBook, bonusByScreen, knows, type AdaptFilter, type LinkState, type TitleLink } from "./rules";

type Screen = "movie" | "series";

/** At most this many films or series of books you've read are added to one deal's pool. */
const EXTRA_LOOKUPS = 12;

/** Your states for titles you know, rated or turned down: what moves the linked titles. */
async function knownStates(userId: string, medias: Media[]) {
  const rows = await getDb()
    .select({
      media: titleStates.media,
      id: titleStates.externalId,
      seen: titleStates.seen,
      rating: titleStates.rating,
      disliked: titleStates.disliked,
    })
    .from(titleStates)
    .where(
      and(
        eq(titleStates.userId, userId),
        inArray(titleStates.media, medias),
        or(eq(titleStates.seen, true), isNotNull(titleStates.rating), eq(titleStates.disliked, true)),
      ),
    );
  return rows.map((r) => ({ media: r.media as Media, id: Number(r.id), state: { seen: r.seen, rating: r.rating, disliked: r.disliked } }));
}

/**
 * What one deal needs: which titles have a link, how much each moves from what
 * you made of the linked one, and (films and series) the ones from books you've
 * read, to add to the pool.
 */
export async function adaptFilterFor(
  userId: string,
  media: Media,
  only: boolean,
): Promise<{ filter: AdaptFilter; extraIds: number[] }> {
  const db = getDb();
  if (media === "book") {
    const [linked, screens] = await Promise.all([
      db.selectDistinct({ id: adaptations.bookId }).from(adaptations),
      knownStates(userId, ["movie", "series"]),
    ]);
    // Film and series ids overlap, so series are keyed as negative numbers here.
    const keyOf = (m: Screen, id: number) => (m === "series" ? -id : id);
    const states = new Map<number, LinkState>(screens.map((s) => [keyOf(s.media as Screen, s.id), s.state]));
    const ids = (m: Screen) => screens.filter((s) => s.media === m).map((s) => s.id);
    const links = (
      await Promise.all(
        (["movie", "series"] as const).map(async (m) =>
          ids(m).length
            ? (
                await db
                  .select({ bookId: adaptations.bookId, screenId: adaptations.screenId })
                  .from(adaptations)
                  .where(and(eq(adaptations.media, m), inArray(adaptations.screenId, ids(m))))
              ).map((l) => ({ bookId: l.bookId, screenId: keyOf(m, l.screenId) }))
            : [],
        ),
      )
    ).flat();
    return { filter: { bonus: bonusByBook(links, states), linked: new Set(linked.map((r) => r.id)), only }, extraIds: [] };
  }

  const [linked, books] = await Promise.all([
    db.select({ id: adaptations.screenId }).from(adaptations).where(eq(adaptations.media, media)),
    knownStates(userId, ["book"]),
  ]);
  const bookStates = new Map(books.map((b) => [b.id, b.state]));
  const links = bookStates.size
    ? await db
        .select({ bookId: adaptations.bookId, screenId: adaptations.screenId })
        .from(adaptations)
        .where(and(eq(adaptations.media, media), inArray(adaptations.bookId, [...bookStates.keys()])))
    : [];
  const bonus = bonusByScreen(links, bookStates);
  const extraIds = [...bonus].filter(([, b]) => b > 0).map(([id]) => id);
  return { filter: { bonus, linked: new Set(linked.map((r) => r.id)), only }, extraIds: extraIds.slice(0, EXTRA_LOOKUPS) };
}

/** Films or series by id, as pool candidates. One TMDb can't return right now is left out. */
export async function screenCandidates(media: Screen, ids: number[], providers: number[]): Promise<MovieCandidate[]> {
  const settled = await Promise.allSettled(
    ids.map(async (id) =>
      media === "movie" ? detailsToCandidate(await getMovieDetails(id), providers) : (await getSeriesDetails(id)).candidate,
    ),
  );
  return settled.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
}

/** Links for these titles, as (title id → ids in the other medium). */
type Found = { from: Media; id: number; media: Media; other: number };

async function linksOf(media: Media, ids: number[]): Promise<Found[]> {
  if (!ids.length) return [];
  const db = getDb();
  if (media === "book") {
    const rows = await db
      .select({ bookId: adaptations.bookId, media: adaptations.media, screenId: adaptations.screenId })
      .from(adaptations)
      .where(inArray(adaptations.bookId, ids));
    return rows.map((r) => ({ from: media, id: r.bookId, media: r.media as Media, other: r.screenId }));
  }
  const rows = await db
    .select({ bookId: adaptations.bookId, screenId: adaptations.screenId })
    .from(adaptations)
    .where(and(eq(adaptations.media, media), inArray(adaptations.screenId, ids)));
  return rows.map((r) => ({ from: media, id: r.screenId, media: "book" as const, other: r.bookId }));
}

/**
 * Films whose credits name a novel's author but that have no link yet: finds
 * the book on Open Library by title and author and keeps the link.
 */
async function linkFromCredits(ids: number[]): Promise<Found[]> {
  const found = await Promise.all(
    ids.map(async (id): Promise<Found | null> => {
      try {
        const d = await getMovieDetails(id);
        if (!d.basedOn) return null;
        const book = await findWork(d.title, d.basedOn);
        if (!book) return null;
        await getDb()
          .insert(adaptations)
          .values({ bookId: book.id, media: "movie", screenId: id, via: "credits" })
          .onConflictDoNothing();
        return { from: "movie", id, media: "book", other: book.id } as Found;
      } catch {
        return null;
      }
    }),
  );
  return found.filter((f) => f !== null);
}

/** What each linked title looks like on a card, fetched fresh (cached for hours). */
async function describe(userId: string, wanted: { media: Media; id: number }[]): Promise<Map<string, TitleLink>> {
  const out = new Map<string, TitleLink>();
  const ids = (m: Media) => [...new Set(wanted.filter((w) => w.media === m).map((w) => w.id))];
  const [books, movies, shows, bookStates, movieStates, showStates] = await Promise.all([
    ids("book").length ? booksByWork(ids("book")).catch(() => new Map()) : new Map(),
    Promise.allSettled(ids("movie").map((id) => getMovieDetails(id))),
    Promise.allSettled(ids("series").map((id) => getSeriesDetails(id))),
    statesFor(userId, "book", ids("book")),
    statesFor(userId, "movie", ids("movie")),
    statesFor(userId, "series", ids("series")),
  ]);
  for (const b of books.values()) {
    // A work with no English edition is a translation's entry ("Hantise"): not worth showing.
    if (b.englishEdition === false) continue;
    const s = bookStates.get(b.id);
    out.set(`book:${b.id}`, {
      media: "book",
      id: b.id,
      title: b.title,
      year: b.year,
      by: b.authors[0] ?? null,
      posterPath: b.posterPath,
      known: knows(s),
      rating: s?.rating ?? null,
      language: "en",
      genreIds: [],
      tags: bookTags(b.subjects),
    });
  }
  for (const r of movies) {
    if (r.status !== "fulfilled") continue;
    const d = r.value;
    const s = movieStates.get(d.id);
    out.set(`movie:${d.id}`, {
      media: "movie",
      id: d.id,
      title: d.title,
      year: d.year,
      by: d.directors[0] ?? null,
      posterPath: d.posterPath,
      known: knows(s),
      rating: s?.rating ?? null,
      language: d.language,
      genreIds: d.genreIds,
      tags: [],
    });
  }
  for (const r of shows) {
    if (r.status !== "fulfilled") continue;
    const d = r.value;
    const s = showStates.get(d.id);
    out.set(`series:${d.id}`, {
      media: "series",
      id: d.id,
      title: d.title,
      year: d.year,
      by: d.creators[0] ?? null,
      posterPath: d.posterPath,
      known: knows(s),
      rating: s?.rating ?? null,
      language: d.language,
      genreIds: d.genreIds,
      tags: [],
    });
  }
  return out;
}

/**
 * Adds each card's link to the other medium: the book a film or series is
 * based on, or a book's film or series (the one you know, else the earliest
 * known link). Never fails the caller: without links, cards are just cards.
 */
export async function withLinks<T extends DeckCard>(userId: string, cards: T[]): Promise<T[]> {
  try {
    const byMedia = (m: Media) => cards.filter((c) => c.media === m).map((c) => c.id);
    const found = (await Promise.all((["movie", "series", "book"] as const).map((m) => linksOf(m, byMedia(m))))).flat();
    const unlinked = byMedia("movie").filter((id) => !found.some((f) => f.from === "movie" && f.id === id));
    found.push(...(await linkFromCredits(unlinked)));

    const described = await describe(
      userId,
      found.map((f) => ({ media: f.media, id: f.other })),
    );
    return cards.map((card) => {
      const options = found
        .filter((f) => f.from === card.media && f.id === card.id)
        .flatMap((f) => described.get(`${f.media}:${f.other}`) ?? []);
      const link = options.find((o) => o.known) ?? options.sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999))[0] ?? null;
      return { ...card, link };
    });
  } catch (error) {
    console.error("[moodreel] adaptation links failed", error);
    return cards;
  }
}

/** The same, for a library's cards keyed by `libraryKey`. */
export async function withLinksByKey<T extends DeckCard>(userId: string, cards: Map<string, T>): Promise<Map<string, T>> {
  const keys = [...cards.keys()];
  const linked = await withLinks(userId, [...cards.values()]);
  return new Map(keys.map((k, i) => [k, linked[i]]));
}
