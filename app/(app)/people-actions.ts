"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireOwner } from "@/lib/session";
import { setPersonPref } from "@/lib/people/server";
import { searchTmdbPeople } from "@/lib/tmdb/people";
import { searchAuthors } from "@/lib/books/openlibrary";
import { authorPhoto, tmdbPhoto, type PhotoRef } from "@/lib/people/types";
import { dislikeOutsideDeck, markSeenOutsideDeck, saveOutsideDeck } from "@/lib/picks/server";

const personSchema = z.object({
  source: z.enum(["tmdb", "openlibrary"]),
  id: z.number().int().positive(),
  name: z.string().min(1).max(200),
  role: z.enum(["director", "creator", "writer", "actor", "author"]),
});

/** Follow, avoid, turn down a suggestion, or (null) clear what you'd set. */
export async function setPerson(person: unknown, kind: "follow" | "avoid" | "dismissed" | null) {
  const owner = await requireOwner();
  await setPersonPref(owner.id, personSchema.parse(person), z.enum(["follow", "avoid", "dismissed"]).nullable().parse(kind));
  refresh();
}

export type PersonMatch = { key: string; name: string; detail: string; photo: PhotoRef };

/** People by name, for "with someone in mind?": TMDb for films and series, Open Library authors for books. */
export async function searchPeople(media: "movie" | "series" | "book", query: unknown): Promise<PersonMatch[]> {
  await requireOwner();
  const q = z.string().trim().min(2).max(80).parse(query);
  try {
    if (media === "book") {
      return (await searchAuthors(q)).map((a) => ({ key: `openlibrary:${a.id}`, name: a.name, detail: a.detail, photo: authorPhoto(a.id) }));
    }
    return (await searchTmdbPeople(q)).map((p) => ({ key: `tmdb:${p.id}`, name: p.name, detail: p.detail, photo: tmdbPhoto(p.photo) }));
  } catch {
    return [];
  }
}

const titleSchema = z.object({
  id: z.number().int().positive(),
  language: z.string().min(2).max(3),
  genreIds: z.array(z.number().int()).max(20),
  tags: z.array(z.string().max(60)).max(12).optional(),
});

/**
 * Save something from a person's (or a list's) page, outside any deck. No page
 * refresh: the button shows the change, and a refresh would lose your place.
 */
export async function saveFromPage(media: "movie" | "series" | "book", title: unknown) {
  const owner = await requireOwner();
  await saveOutsideDeck(owner.id, z.enum(["movie", "series", "book"]).parse(media), titleSchema.parse(title));
}

/** "Seen it" / "Read it" from a person's (or a list's) page: the same as that swipe. */
export async function seenFromPage(media: "movie" | "series" | "book", title: unknown) {
  const owner = await requireOwner();
  await markSeenOutsideDeck(owner.id, z.enum(["movie", "series", "book"]).parse(media), titleSchema.parse(title));
}

/** "Not for me" from a person's, a list's or a collection's page: the same as that swipe. */
export async function notForMeFromPage(media: "movie" | "series" | "book", title: unknown) {
  const owner = await requireOwner();
  await dislikeOutsideDeck(owner.id, z.enum(["movie", "series", "book"]).parse(media), titleSchema.parse(title));
}
