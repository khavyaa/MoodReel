import "server-only";
import { getMovieDetails } from "@/lib/tmdb/movies";
import { LANGUAGE_LABEL } from "@/lib/taste/types";

/** What a Saved or History row shows. Details come fresh from TMDb (cached for hours). */
export type LibraryMovie = {
  id: number;
  title: string;
  year: number | null;
  languageLabel: string;
  posterPath: string | null;
  rating: number;
  runtime: number | null;
  genres: string[];
  overview: string;
  streamingOn: string[];
  trailerKey: string | null;
};

/** Fetches details for each id; a title TMDb can't return right now is left out rather than failing the page. */
export async function libraryMovies(ids: number[]): Promise<Map<number, LibraryMovie>> {
  const results = await Promise.allSettled(ids.map((id) => getMovieDetails(id)));
  const movies = new Map<number, LibraryMovie>();
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    const d = r.value;
    movies.set(d.id, {
      id: d.id,
      title: d.title,
      year: d.year,
      languageLabel: LANGUAGE_LABEL[d.language] ?? d.language.toUpperCase(),
      posterPath: d.posterPath,
      rating: d.rating,
      runtime: d.runtime,
      genres: d.genres,
      overview: d.overview,
      streamingOn: d.streamingOn,
      trailerKey: d.trailerKey,
    });
  }
  return movies;
}
