"use server";

import { z } from "zod";
import { requireOwner } from "@/lib/session";
import { LIST_PAGE } from "@/lib/picks/server";
import { personPage } from "@/lib/people/works";
import { personRows } from "@/components/people/person-rows";
import { listRows } from "@/components/lists/list-rows";
import { listEntries } from "@/lib/lists/server";
import type { FlowPage } from "@/components/flow/more-flow";

/*
 * The next page of a long cover flow, rendered here and handed to the flow
 * ready to show (the rows hold client buttons, so they render as they would
 * with the page).
 */

const offsetSchema = z.number().int().min(0).max(5000);

/** More of a person's films, series or books. */
export async function morePersonWork(source: unknown, id: unknown, media: unknown, offset: unknown): Promise<FlowPage> {
  const owner = await requireOwner();
  const src = z.enum(["tmdb", "openlibrary"]).parse(source);
  const page = await personPage(src, z.number().int().positive().parse(id));
  if (!page) return { items: [], infos: [] };
  const kind = z.enum(["movie", "series", "book"]).parse(media);
  const from = offsetSchema.parse(offset);
  const all = kind === "movie" ? page.films : kind === "series" ? page.series : page.books;
  return personRows(owner.id, all.slice(from, from + LIST_PAGE));
}

/** More of a list or a collection. */
export async function moreListTitles(slug: unknown, offset: unknown): Promise<FlowPage> {
  const owner = await requireOwner();
  const list = await listEntries(z.string().max(80).parse(slug));
  if (!list) return { items: [], infos: [] };
  const from = offsetSchema.parse(offset);
  return listRows(owner.id, list.def, list.entries.slice(from, from + LIST_PAGE), from);
}
