import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { applyAction, emptyMovieState, MOVIE_ACTION_TYPES } from "@/lib/types";
import { rowToState, type MovieStateRow } from "@/lib/movie-states-server";
import { handleRouteError, jsonError } from "@/lib/api";

const bodySchema = z.object({
  tmdbMovieId: z.number().int().positive(),
  action: z.enum(MOVIE_ACTION_TYPES as [string, ...string[]]),
  mood: z.string().max(64).nullish(),
  language: z.string().max(8).nullish(),
  genreIds: z.array(z.number().int()).max(32).optional(),
  userRating: z.number().int().min(1).max(10).nullish(),
});

export async function POST(request: Request) {
  try {
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return jsonError("Invalid action payload.", 400, { issues: parsed.error.issues });
    }
    const body = parsed.data;

    const supabase = await createClient();
    if (!supabase) {
      return jsonError("Supabase is not configured; actions stay on this device.", 401, {
        code: "guest",
      });
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return jsonError("Not signed in.", 401, { code: "guest" });
    }

    const { data: existing } = await supabase
      .from("movie_states")
      .select("tmdb_movie_id, liked, disliked, skipped, watchlisted, watched, user_rating, updated_at")
      .eq("user_id", user.id)
      .eq("tmdb_movie_id", body.tmdbMovieId)
      .maybeSingle();

    const current = existing
      ? rowToState(existing as MovieStateRow)
      : emptyMovieState(body.tmdbMovieId);
    const next = applyAction(current, body.action as (typeof MOVIE_ACTION_TYPES)[number]);
    if (body.userRating !== undefined && body.userRating !== null) {
      next.userRating = body.userRating;
    }

    const [actionResult, stateResult] = await Promise.all([
      supabase.from("movie_actions").insert({
        user_id: user.id,
        tmdb_movie_id: body.tmdbMovieId,
        action: body.action,
        mood: body.mood ?? null,
        source_language: body.language ?? null,
        genre_ids: body.genreIds ?? [],
      }),
      supabase.from("movie_states").upsert(
        {
          user_id: user.id,
          tmdb_movie_id: body.tmdbMovieId,
          liked: next.liked,
          disliked: next.disliked,
          skipped: next.skipped,
          watchlisted: next.watchlisted,
          watched: next.watched,
          user_rating: next.userRating,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,tmdb_movie_id" },
      ),
    ]);

    const error = actionResult.error ?? stateResult.error;
    if (error) return jsonError(error.message, 500);

    return NextResponse.json({ state: next });
  } catch (error) {
    return handleRouteError(error);
  }
}
