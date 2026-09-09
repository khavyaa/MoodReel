import { NextResponse, type NextRequest } from "next/server";
import { getMoviesByIds } from "@/lib/tmdb";
import { handleRouteError, parseIdList } from "@/lib/api";

const MAX_IDS = 60;

/** Hydrates saved TMDb ids into cards for the watchlist and watched grids. */
export async function GET(request: NextRequest) {
  try {
    const ids = parseIdList(request.nextUrl.searchParams.get("ids")).slice(0, MAX_IDS);
    if (ids.length === 0) return NextResponse.json({ movies: [] });

    const movies = await getMoviesByIds(ids);
    return NextResponse.json({ movies });
  } catch (error) {
    return handleRouteError(error);
  }
}
