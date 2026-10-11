import "server-only";
import type { DeckCard } from "@/lib/deck/build-movies";
import { passesGate } from "@/lib/taste/rules";
import { LANGUAGE_LABEL, type MovieCandidate } from "@/lib/taste/types";
import { getMovieDetails, type MovieDetails } from "@/lib/tmdb/movies";
import { servicesOn } from "@/lib/tmdb/providers";
import { getSeriesDetails, type SeriesDetails } from "@/lib/tmdb/series";
import { seriesCard } from "@/lib/deck/build-series";
import { bookCard, withNytWeeks } from "@/lib/deck/build-books";
import { bookDescription, booksByWork } from "@/lib/books/openlibrary";
import type { BookCandidate } from "@/lib/books/rules";

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
    book: null,
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

export const libraryKey = (media: "movie" | "series" | "book", id: number) => `${media}:${id}`;

/** Cards for a mixed list of films and series, keyed by `libraryKey`. */
export async function libraryTitles(
  items: { media: "movie" | "series" | "book"; id: number }[],
  providers: number[],
): Promise<Map<string, LibraryMovie>> {
  const idsOf = (m: string) => [...new Set(items.filter((i) => i.media === m).map((i) => i.id))];
  const [movies, shows, books] = await Promise.all([
    movieDetailsFor(idsOf("movie")),
    seriesDetailsFor(idsOf("series")),
    bookCardsFor(idsOf("book")),
  ]);
  const cards = new Map<string, LibraryMovie>();
  for (const [id, d] of movies) cards.set(libraryKey("movie", id), detailsToCard(d, providers));
  for (const [id, d] of shows) cards.set(libraryKey("series", id), seriesCard(d, providers));
  for (const [id, c] of books) cards.set(libraryKey("book", id), c);
  return cards;
}

/** Book cards by Open Library work, with NYT weeks and descriptions. A work Open Library can't return is left out. */
export async function bookCardsFor(ids: number[]): Promise<Map<number, LibraryMovie>> {
  if (!ids.length) return new Map();
  const found = await booksByWork(ids).catch(() => new Map<number, BookCandidate>());
  const books = await withNytWeeks([...found.values()]);
  const descriptions = await Promise.all(books.map((b) => bookDescription(b.id)));
  return new Map(books.map((b, i) => [b.id, bookCard(b, descriptions[i])]));
}
