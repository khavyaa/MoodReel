"use server";

import { z } from "zod";
import { requireOwner } from "@/lib/session";
import { listBySlug } from "@/lib/lists/catalog";
import { setListFollow } from "@/lib/lists/server";
import { searchCollections, type CollectionSummary } from "@/lib/tmdb/movies";

/** Follow a list (its titles rank a little higher in your decks, with a badge), or stop following it. */
export async function followList(slug: unknown, follow: boolean) {
  const owner = await requireOwner();
  const s = z.string().max(80).parse(slug);
  if (!listBySlug(s)) throw new Error("No such list.");
  await setListFollow(owner.id, s, z.boolean().parse(follow));
}

/** TMDb film collections by name, for the Lists page. */
export async function findCollections(query: unknown): Promise<CollectionSummary[]> {
  await requireOwner();
  const q = z.string().trim().min(2).max(80).parse(query);
  return searchCollections(q).catch(() => []);
}
