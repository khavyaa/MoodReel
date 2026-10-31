import "server-only";
import type { HistoryEntry, SeenEntry, Unavailable } from "@/components/library/library-lists";
import { withLinksByKey } from "@/lib/adaptations/server";
import { libraryKey, libraryTitles, type LibraryMovie } from "@/lib/library";
import { LIST_PAGE, pickHistory, providersFor, savedTitles, seenTitles, turnedDownTitles, type Media } from "@/lib/picks/server";

/*
 * One page (LIST_PAGE titles from `offset`) of Saved, of your picks, and of
 * what you've seen or read, with their details: for the pages' first load and
 * for the flows asking for more as you near the end. Titles whose details
 * can't be fetched just now come back as `unavailable`, so they're never lost.
 */

/**
 * A page of Saved. If none of a page's titles load (the catalogue is down for
 * those ids), it reads on, a few pages at most, so the flow always has cards
 * to show and to load more from.
 */
export async function savedPage(userId: string, media: Media | null, offset: number) {
  const providers = await providersFor(userId);
  const movies: LibraryMovie[] = [];
  const unavailable: Unavailable[] = [];
  let fetched = 0;
  for (let tries = 0; tries < 4 && movies.length === 0; tries++) {
    const saved = await savedTitles(userId, LIST_PAGE, media ?? undefined, offset + fetched);
    fetched += saved.length;
    const cards = await withLinksByKey(userId, await libraryTitles(saved, providers));
    movies.push(...saved.flatMap((s) => cards.get(libraryKey(s.media, s.id)) ?? []));
    unavailable.push(...saved.filter((s) => !cards.has(libraryKey(s.media, s.id))).map((s) => ({ media: s.media, id: s.id, list: "saved" as const })));
    if (saved.length < LIST_PAGE) break;
  }
  return { movies, unavailable, fetched };
}

export async function picksPage(userId: string, offset: number) {
  const picks = await pickHistory(userId, LIST_PAGE, offset);
  const cards = await withLinksByKey(userId, await libraryTitles(picks, await providersFor(userId)));
  const entries: HistoryEntry[] = [];
  const unavailable: Unavailable[] = [];
  for (const p of picks) {
    const movie = cards.get(libraryKey(p.media, p.id));
    if (!movie) {
      unavailable.push({ media: p.media, id: p.id, list: "picked", at: p.pickedAt?.toISOString() });
      continue;
    }
    entries.push({
      sessionId: p.sessionId,
      mood: p.mood,
      why: p.why,
      pickedAt: p.pickedAt?.toISOString() ?? null,
      seen: p.seen,
      watching: p.watching,
      dropped: p.dropped,
      followUp: p.followUp,
      stars: p.rating === null ? null : Math.round(p.rating / 2),
      movie,
    });
  }
  return { entries, unavailable, fetched: picks.length };
}

export async function seenPage(userId: string, offset: number) {
  const seen = await seenTitles(userId, LIST_PAGE, offset);
  const cards = await libraryTitles(seen, await providersFor(userId));
  const entries: SeenEntry[] = [];
  const unavailable: Unavailable[] = [];
  for (const s of seen) {
    const movie = cards.get(libraryKey(s.media, s.id));
    if (movie) entries.push({ at: s.at.toISOString(), stars: s.rating === null ? null : Math.round(s.rating / 2), movie });
    else unavailable.push({ media: s.media, id: s.id, list: "seen", at: s.at.toISOString() });
  }
  return { entries, unavailable, fetched: seen.length };
}

/** A title you turned down: when, and how (Not for me, or Gave up / Dropped). */
export type TurnedDownEntry = { at: string; how: "disliked" | "dropped"; movie: LibraryMovie };

export async function turnedDownPage(userId: string, offset: number) {
  const rows = await turnedDownTitles(userId, LIST_PAGE, offset);
  const cards = await libraryTitles(rows, await providersFor(userId));
  const entries: TurnedDownEntry[] = rows.flatMap((r) => {
    const movie = cards.get(libraryKey(r.media, r.id));
    return movie ? [{ at: r.at.toISOString(), how: r.how, movie }] : [];
  });
  return { entries, fetched: rows.length };
}
