import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { listFollows, listItems, titleStates } from "@/lib/db/schema";
import { getCollection, getMovieDetails, topRatedMovies } from "@/lib/tmdb/movies";
import { topRatedShows } from "@/lib/tmdb/series";
import { sourceOf, type Media } from "@/lib/picks/server";
import { LISTS, listBySlug, collectionSlug, type ListDef } from "./catalog";
import { ensureListItems } from "./sync";

/** One title on a list: its id, and the year it won, when the list says. */
export type ListEntry = { id: number; year: number | null };

/**
 * A list's titles, in the list's order: award winners newest first, TMDb's
 * top-rated by rank, a collection in release order. A collection's title
 * comes from TMDb. Null when the list doesn't exist.
 */
export async function listEntries(slug: string): Promise<{ def: ListDef; entries: ListEntry[] } | null> {
  const def = listBySlug(slug);
  if (!def) return null;
  const source = def.source;
  if (source.kind === "wikidata") {
    await ensureListItems(def);
    const rows = await getDb()
      .select({ id: listItems.externalId, year: listItems.year })
      .from(listItems)
      .where(eq(listItems.listSlug, slug))
      .orderBy(sql`${listItems.year} desc nulls last`, listItems.externalId);
    return { def, entries: rows };
  }
  if (source.kind === "tmdb-top") {
    const pages = await Promise.all(
      Array.from({ length: source.pages }, (_, i) => (def.media === "movie" ? topRatedMovies(i + 1) : topRatedShows(i + 1)).catch(() => [])),
    );
    const seen = new Set<number>();
    const entries = pages.flat().flatMap((c) => (seen.has(c.id) ? [] : (seen.add(c.id), [{ id: c.id, year: c.year }])));
    return { def, entries };
  }
  const collection = await getCollection(source.id).catch(() => null);
  if (!collection) return null;
  return {
    def: { ...def, title: collection.name, short: collection.name.replace(/ Collection$/, ""), blurb: collection.overview || def.blurb },
    entries: collection.films.map((f) => ({ id: f.id, year: f.year })),
  };
}

/** How many of these titles you've seen or read. */
export async function seenCount(userId: string, media: Media, ids: number[]): Promise<number> {
  if (!ids.length) return 0;
  const [row] = await getDb()
    .select({ n: sql<number>`count(*)` })
    .from(titleStates)
    .where(
      and(
        eq(titleStates.userId, userId),
        eq(titleStates.media, media),
        eq(titleStates.source, sourceOf(media)),
        eq(titleStates.seen, true),
        inArray(titleStates.externalId, ids.map(String)),
      ),
    );
  return Number(row?.n ?? 0);
}

export async function followedListSlugs(userId: string): Promise<string[]> {
  const rows = await getDb()
    .select({ slug: listFollows.listSlug })
    .from(listFollows)
    .where(eq(listFollows.userId, userId))
    .orderBy(desc(listFollows.createdAt));
  return rows.map((r) => r.slug);
}

export async function setListFollow(userId: string, slug: string, follow: boolean) {
  const db = getDb();
  if (follow) await db.insert(listFollows).values({ userId, listSlug: slug }).onConflictDoNothing();
  else await db.delete(listFollows).where(and(eq(listFollows.userId, userId), eq(listFollows.listSlug, slug)));
}

/**
 * For one kind of title, which ones are on lists you follow, and the list's
 * short name for the card's badge ("On Oscar Best Picture").
 */
export async function followedListTitles(userId: string, media: Media): Promise<Map<number, string>> {
  const slugs = await followedListSlugs(userId);
  const out = new Map<number, string>();
  for (const slug of slugs) {
    const def = listBySlug(slug);
    if (!def || def.media !== media) continue;
    const list = await listEntries(slug).catch(() => null);
    if (!list) continue;
    for (const e of list.entries) if (!out.has(e.id)) out.set(e.id, list.def.short);
  }
  return out;
}

/** Collections you've started: the franchises of films you've seen, and how far through each you are. */
export async function startedCollections(userId: string): Promise<{ slug: string; title: string; seen: number; total: number }[]> {
  const rows = await getDb()
    .select({ id: titleStates.externalId })
    .from(titleStates)
    .where(and(eq(titleStates.userId, userId), eq(titleStates.media, "movie"), eq(titleStates.seen, true)))
    .orderBy(desc(titleStates.updatedAt))
    .limit(40);
  const details = await Promise.allSettled(rows.map((r) => getMovieDetails(Number(r.id))));
  const ids = new Set<number>();
  for (const d of details) if (d.status === "fulfilled" && d.value.collection) ids.add(d.value.collection.id);
  const lists = await Promise.all([...ids].slice(0, 12).map((id) => listEntries(collectionSlug(id)).catch(() => null)));
  const started = await Promise.all(
    lists.flatMap((l) => (l && l.entries.length > 1 ? [l] : [])).map(async (l) => ({
      slug: l.def.slug,
      title: l.def.title,
      seen: await seenCount(userId, "movie", l.entries.map((e) => e.id)),
      total: l.entries.length,
    })),
  );
  return started.filter((c) => c.seen < c.total);
}

export { LISTS };
