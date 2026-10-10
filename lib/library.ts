import "server-only";
import type { DeckCard } from "@/lib/deck/build-movies";
import { passesGate } from "@/lib/taste/rules";
import { LANGUAGE_LABEL, type MovieCandidate } from "@/lib/taste/types";
import { getMovieDetails, type MovieDetails } from "@/lib/tmdb/movies";
import { servicesOn } from "@/lib/tmdb/providers";

/** A Saved or History row shows the same card the deck does. */
export type LibraryMovie = DeckCard;

export function detailsToCandidate(d: MovieDetails, providers: number[]): MovieCandidate {
  return {
    id: d.id,
    title: d.title,
    originalTitle: d.originalTitle,
    language: d.language,
    year: d.year,
    releaseDate: d.year ? `${d.year}-01-01` : null,
    genreIds: d.genreIds,
    overview: d.overview,
    posterPath: d.posterPath,
    backdropPath: d.backdropPath,
    voteAverage: d.rating,
    voteCount: d.votes,
    popularity: 0,
    onMyServices: servicesOn(d.providers, providers).length > 0,
  };
}

export function detailsToCard(d: MovieDetails, providers: number[]): DeckCard {
  return {
    id: d.id,
    title: d.title,
    originalTitle: d.originalTitle,
    year: d.year,
    language: d.language,
    languageLabel: LANGUAGE_LABEL[d.language] ?? d.language.toUpperCase(),
    overview: d.overview,
    posterPath: d.posterPath,
    backdropPath: d.backdropPath,
    rating: d.rating,
    votes: d.votes,
    genreIds: d.genreIds,
    genres: d.genres,
    runtime: d.runtime,
    directors: d.directors,
    cast: d.cast,
    streamingOn: servicesOn(d.providers, providers),
    gate: passesGate(detailsToCandidate(d, providers)).reason ?? null,
    trailerKey: d.trailerKey,
  };
}

/** Details for each id, fresh from TMDb (cached for hours). One TMDb can't return right now is left out, not fatal. */
export async function movieDetailsFor(ids: number[]): Promise<Map<number, MovieDetails>> {
  const results = await Promise.allSettled(ids.map((id) => getMovieDetails(id)));
  const found = new Map<number, MovieDetails>();
  for (const r of results) if (r.status === "fulfilled") found.set(r.value.id, r.value);
  return found;
}

export async function libraryMovies(ids: number[], providers: number[]): Promise<Map<number, LibraryMovie>> {
  const details = await movieDetailsFor(ids);
  return new Map([...details].map(([id, d]) => [id, detailsToCard(d, providers)]));
}
