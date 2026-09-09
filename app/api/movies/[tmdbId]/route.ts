import { NextResponse } from "next/server";
import { getMovieDetails } from "@/lib/tmdb";
import { handleRouteError, jsonError } from "@/lib/api";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tmdbId: string }> },
) {
  try {
    const { tmdbId } = await params;
    const id = Number(tmdbId);
    if (!Number.isInteger(id) || id <= 0) return jsonError("Invalid movie id.", 400);

    const movie = await getMovieDetails(id, process.env.TMDB_WATCH_REGION ?? "IN");
    return NextResponse.json({ movie });
  } catch (error) {
    return handleRouteError(error);
  }
}
