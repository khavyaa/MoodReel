"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireOwner } from "@/lib/session";
import { updateMovieState } from "@/lib/picks/server";

const movieId = z.number().int().positive();

/** Take a film off the saved list without saying you've seen it. */
export async function removeSaved(id: number) {
  const owner = await requireOwner();
  await updateMovieState(owner.id, movieId.parse(id), "unsaved", { saved: false });
  refresh();
}

/** Watched it: off the saved list, and it never comes back in a deck. */
export async function markSeen(id: number) {
  const owner = await requireOwner();
  await updateMovieState(owner.id, movieId.parse(id), "seen", { saved: false, seen: true });
  refresh();
}

/**
 * Rate a past pick, 1 to 5 stars (stored as 2–10 to match the 1–10 column),
 * or clear it with null. Rating implies you watched it. Not logged as an
 * action, so re-rating never shifts your taste.
 */
export async function rateMovie(id: number, stars: number | null) {
  const owner = await requireOwner();
  const value = z.number().int().min(1).max(5).nullable().parse(stars);
  await updateMovieState(owner.id, movieId.parse(id), null, {
    rating: value === null ? null : value * 2,
    ...(value === null ? {} : { seen: true }),
  });
  refresh();
}
