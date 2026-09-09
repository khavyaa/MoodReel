import { NextResponse, type NextRequest } from "next/server";
import { searchMovies } from "@/lib/tmdb";
import { handleRouteError, jsonError, parseLanguages } from "@/lib/api";

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get("q")?.trim();
    if (!query) return jsonError("Missing search query.", 400);

    const languages = parseLanguages(request.nextUrl.searchParams.get("languages"));
    const movies = await searchMovies(query, languages);
    return NextResponse.json({ query, count: movies.length, movies });
  } catch (error) {
    return handleRouteError(error);
  }
}
