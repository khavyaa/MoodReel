import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { MovieState, MovieActionType } from "@/lib/types";
import { buildTasteProfile, EMPTY_TASTE, type TasteProfile } from "@/lib/recommendations/rank-movies";

export type MovieStateRow = {
  tmdb_movie_id: number;
  liked: boolean | null;
  disliked: boolean | null;
  skipped: boolean | null;
  watchlisted: boolean | null;
  watched: boolean | null;
  user_rating: number | null;
  updated_at: string;
};

export function rowToState(row: MovieStateRow): MovieState {
  return {
    tmdbMovieId: row.tmdb_movie_id,
    liked: Boolean(row.liked),
    disliked: Boolean(row.disliked),
    skipped: Boolean(row.skipped),
    watchlisted: Boolean(row.watchlisted),
    watched: Boolean(row.watched),
    userRating: row.user_rating,
    updatedAt: row.updated_at,
  };
}

export type UserContext = {
  userId: string | null;
  states: MovieState[];
  taste: TasteProfile;
};

/** Loads everything the recommender needs about the signed-in user in one place. */
export async function loadUserContext(): Promise<UserContext> {
  const supabase = await createClient();
  if (!supabase) return { userId: null, states: [], taste: EMPTY_TASTE };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { userId: null, states: [], taste: EMPTY_TASTE };

  const [statesResult, actionsResult] = await Promise.all([
    supabase
      .from("movie_states")
      .select("tmdb_movie_id, liked, disliked, skipped, watchlisted, watched, user_rating, updated_at")
      .eq("user_id", user.id),
    supabase
      .from("movie_actions")
      .select("action, genre_ids, source_language")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(300),
  ]);

  const states = ((statesResult.data ?? []) as MovieStateRow[]).map(rowToState);

  type ActionRow = { action: MovieActionType; genre_ids: number[] | null; source_language: string | null };
  const taste = buildTasteProfile(
    ((actionsResult.data ?? []) as ActionRow[]).map((row) => ({
      action: row.action,
      genreIds: row.genre_ids ?? [],
      language: row.source_language,
    })),
  );

  return { userId: user.id, states, taste };
}
