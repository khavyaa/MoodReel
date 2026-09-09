"use client";

import {
  applyLocalAction,
  readLocalStates,
  rememberMovie,
  writeLocalState,
} from "@/lib/local-store";
import type { MovieActionType, MovieCard, MovieState } from "@/lib/types";

export type ActionInput = {
  movie: MovieCard;
  action: MovieActionType;
  mood?: string | null;
  userRating?: number | null;
};

export type StatesSnapshot = {
  states: Record<number, MovieState>;
  guest: boolean;
};

/**
 * Reads movie states from Supabase when signed in and from localStorage otherwise,
 * so the deck, watchlist and watched pages behave the same for guests.
 */
export async function loadStates(): Promise<StatesSnapshot> {
  try {
    const res = await fetch("/api/movie-states", { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as { states: MovieState[] };
      return {
        states: Object.fromEntries(data.states.map((s) => [s.tmdbMovieId, s])),
        guest: false,
      };
    }
  } catch {
    // Offline or server error: fall through to local history.
  }
  return { states: readLocalStates(), guest: true };
}

/**
 * Records one swipe. Writes through to Supabase when possible and always keeps a
 * local copy so the UI stays correct offline and for guests.
 */
export async function recordAction({
  movie,
  action,
  mood,
  userRating,
}: ActionInput): Promise<MovieState> {
  rememberMovie(movie);
  const optimistic = applyLocalAction(movie.id, action, userRating);

  try {
    const res = await fetch("/api/movie-actions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tmdbMovieId: movie.id,
        action,
        mood: mood ?? null,
        language: movie.language,
        genreIds: movie.genreIds,
        userRating: userRating ?? null,
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as { state: MovieState };
      writeLocalState(data.state);
      return data.state;
    }
  } catch {
    // Keep the optimistic local state; a signed-in user can re-swipe later.
  }
  return optimistic;
}
