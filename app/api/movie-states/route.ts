import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rowToState, type MovieStateRow } from "@/lib/movie-states-server";
import { handleRouteError, jsonError } from "@/lib/api";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    if (!supabase) return jsonError("Supabase is not configured.", 401, { code: "guest" });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return jsonError("Not signed in.", 401, { code: "guest" });

    let query = supabase
      .from("movie_states")
      .select("tmdb_movie_id, liked, disliked, skipped, watchlisted, watched, user_rating, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    const filter = request.nextUrl.searchParams.get("filter");
    if (filter === "watchlist") query = query.eq("watchlisted", true);
    if (filter === "watched") query = query.eq("watched", true);

    const { data, error } = await query;
    if (error) return jsonError(error.message, 500);

    return NextResponse.json({
      states: ((data ?? []) as MovieStateRow[]).map(rowToState),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
