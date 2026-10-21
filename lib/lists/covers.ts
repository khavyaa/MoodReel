import "server-only";
import { libraryKey, libraryTitles } from "@/lib/library";
import { collectionSlug, LISTS } from "./catalog";
import { followedListSlugs, listEntries, seenCount, startedCollections } from "./server";
import { getMovieDetails, mostVotedMovies } from "@/lib/tmdb/movies";
import { providersFor } from "@/lib/picks/server";

/** A list as a cover in the Lists flow: its first title's poster, its size, and how far through it you are. */
export type ListCover = {
  slug: string;
  title: string;
  blurb: string;
  media: "movie" | "series" | "book";
  kind: "list" | "collection";
  total: number;
  seen: number;
  poster: string | null;
  following: boolean;
};

async function cover(userId: string, slug: string, followed: Set<string>, providers: number[]): Promise<ListCover | null> {
  const list = await listEntries(slug).catch(() => null);
  if (!list || list.entries.length === 0) return null;
  const { def, entries } = list;
  const ids = entries.map((e) => e.id);
  const [seen, cards] = await Promise.all([
    seenCount(userId, def.media, ids),
    libraryTitles([{ media: def.media, id: ids[0] }], providers).catch(() => new Map()),
  ]);
  return {
    slug: def.slug,
    title: def.title,
    blurb: def.blurb,
    media: def.media,
    kind: def.source.kind === "collection" ? "collection" : "list",
    total: entries.length,
    seen,
    poster: cards.get(libraryKey(def.media, ids[0]))?.posterPath ?? null,
    following: followed.has(def.slug),
  };
}

/** Every list, and the collections you're part-way through. */
export async function listCovers(userId: string): Promise<{ lists: ListCover[]; started: ListCover[] }> {
  const [followed, providers, started] = await Promise.all([
    followedListSlugs(userId).then((s) => new Set(s)),
    providersFor(userId),
    startedCollections(userId).catch(() => []),
  ]);
  const [lists, startedCovers] = await Promise.all([
    Promise.all(LISTS.map((l) => cover(userId, l.slug, followed, providers))),
    Promise.all(started.map((c) => cover(userId, c.slug, followed, providers))),
  ]);
  return { lists: lists.flatMap((c) => (c ? [c] : [])), started: startedCovers.flatMap((c) => (c ? [c] : [])) };
}

/**
 * Well-known franchises to start, before you've started any: the collections
 * the most-watched English films belong to, most-watched first.
 */
export async function suggestedCollections(userId: string, skip: Set<string>): Promise<ListCover[]> {
  const [followed, providers, pages] = await Promise.all([
    followedListSlugs(userId).then((s) => new Set(s)),
    providersFor(userId),
    Promise.all([1, 2].map((p) => mostVotedMovies("en", p).catch(() => []))),
  ]);
  const details = await Promise.allSettled(pages.flat().map((m) => getMovieDetails(m.id)));
  const slugs: string[] = [];
  for (const d of details) {
    const id = d.status === "fulfilled" ? d.value.collection?.id : undefined;
    const slug = id ? collectionSlug(id) : null;
    if (slug && !skip.has(slug) && !slugs.includes(slug)) slugs.push(slug);
  }
  const covers = await Promise.all(slugs.slice(0, 12).map((slug) => cover(userId, slug, followed, providers)));
  return covers.flatMap((c) => (c && c.total > 1 ? [c] : []));
}
