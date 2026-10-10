import "server-only";
import type { DeckCard } from "@/lib/deck/build-movies";
import { passesGate } from "@/lib/taste/rules";
import { LANGUAGE_LABEL, type MovieCandidate } from "@/lib/taste/types";
import { getMovieDetails, type MovieDetails } from "@/lib/tmdb/movies";
import { servicesOn } from "@/lib/tmdb/providers";
import { getSeriesDetails, type SeriesDetails } from "@/lib/tmdb/series";
import { seriesCard } from "@/lib/deck/build-series";

/** A Saved or History row shows the same card the deck does, film or series. */
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
    media: "movie",
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
    series: null,
  };
}

/** Details for each id, fresh from TMDb (cached for hours). One TMDb can't return right now is left out, not fatal. */
export async function movieDetailsFor(ids: number[]): Promise<Map<number, MovieDetails>> {
  const results = await Promise.allSettled(ids.map((id) => getMovieDetails(id)));
  const found = new Map<number, MovieDetails>();
  for (const r of results) if (r.status === "fulfilled") found.set(r.value.id, r.value);
  return found;
}

/* ----------------------------------------------------------------- series */

export async function seriesDetailsFor(ids: number[]): Promise<Map<number, SeriesDetails>> {
  const results = await Promise.allSettled(ids.map((id) => getSeriesDetails(id)));
  const found = new Map<number, SeriesDetails>();
  for (const r of results) if (r.status === "fulfilled") found.set(r.value.id, r.value);
  return found;
}

export const libraryKey = (media: "movie" | "series", id: number) => `${media}:${id}`;

/** Cards for a mixed list of films and series, keyed by `libraryKey`. */
export async function libraryTitles(
  items: { media: "movie" | "series"; id: number }[],
  providers: number[],
): Promise<Map<string, LibraryMovie>> {
  const movieIds = [...new Set(items.filter((i) => i.media === "movie").map((i) => i.id))];
  const seriesIds = [...new Set(items.filter((i) => i.media === "series").map((i) => i.id))];
  const [movies, shows] = await Promise.all([movieDetailsFor(movieIds), seriesDetailsFor(seriesIds)]);
  const cards = new Map<string, LibraryMovie>();
  for (const [id, d] of movies) cards.set(libraryKey("movie", id), detailsToCard(d, providers));
  for (const [id, d] of shows) cards.set(libraryKey("series", id), seriesCard(d, providers));
  return cards;
}
