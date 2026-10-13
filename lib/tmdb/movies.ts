import "server-only";
import { tmdb } from "./client";
import { WRITING_JOBS, type Person } from "@/lib/people/types";
import { EXCLUDED_KEYWORDS, MOVIE_GENRE_NAMES } from "@/lib/taste/rules";
import type { MovieCandidate } from "@/lib/taste/types";

export const WATCH_REGION = process.env.TMDB_WATCH_REGION || "IN";


export type TmdbMovie = {
  id: number;
  title: string;
  original_title: string;
  original_language: string;
  release_date?: string | null;
  genre_ids?: number[];
  genres?: { id: number; name: string }[];
  overview?: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  vote_count: number;
  popularity: number;
};

export function toCandidate(m: TmdbMovie, onMyServices: boolean): MovieCandidate {
  const year = m.release_date ? Number(m.release_date.slice(0, 4)) : null;
  return {
    id: m.id,
    title: m.title,
    originalTitle: m.original_title,
    language: m.original_language,
    year: year && Number.isFinite(year) ? year : null,
    releaseDate: m.release_date || null,
    genreIds: m.genre_ids ?? m.genres?.map((g) => g.id) ?? [],
    overview: m.overview ?? "",
    posterPath: m.poster_path,
    backdropPath: m.backdrop_path,
    voteAverage: m.vote_average ?? 0,
    voteCount: m.vote_count ?? 0,
    popularity: m.popularity ?? 0,
    onMyServices,
  };
}

export type DiscoverQuery = {
  language: string;
  genres: number[];
  /** When set, query these keywords (any of) instead of genres. */
  keywords?: number[];
  excludeGenres: number[];
  minVotes: number;
  /** Cap on votes: pulls well-rated films fewer people have seen. */
  maxVotes?: number;
  runtimeMax: number | null;
  /** Restrict to these TMDb provider ids (flat-rate, in your region); empty means anywhere. */
  providers: number[];
  sortBy: "vote_average.desc" | "popularity.desc";
  page: number;
};

/** Exported for tests: the exact TMDb parameters for one pool query. */
export function discoverParams(q: DiscoverQuery, today = new Date().toISOString().slice(0, 10)) {
  return {
    include_adult: false,
    include_video: false,
    language: "en-US",
    with_original_language: q.language,
    ...(q.keywords?.length
      ? { with_keywords: q.keywords.join("|") } // any of the mood's keywords
      : { with_genres: q.genres.join("|") }), // any of the mood's genres
    without_genres: q.excludeGenres.join(","),
    without_keywords: EXCLUDED_KEYWORDS.join(","),
    "vote_count.gte": q.minVotes,
    "vote_count.lte": q.maxVotes,
    "with_runtime.gte": 70, // no shorts
    "with_runtime.lte": q.runtimeMax ?? undefined,
    "primary_release_date.lte": today, // released, not announced
    sort_by: q.sortBy,
    page: q.page,
    ...(q.providers.length
      ? { with_watch_providers: q.providers.join("|"), watch_region: WATCH_REGION, with_watch_monetization_types: "flatrate" }
      : {}),
  };
}

export async function discoverMovies(q: DiscoverQuery): Promise<MovieCandidate[]> {
  const data = await tmdb<{ results: TmdbMovie[] }>("/discover/movie", discoverParams(q), 60 * 60 * 6);
  return data.results.map((m) => toCandidate(m, q.providers.length > 0));
}

/* ---------------------------------------------------------------- details */

export type MovieDetails = {
  id: number;
  title: string;
  year: number | null;
  language: string;
  genreIds: number[];
  posterPath: string | null;
  rating: number;
  overview: string;
  runtime: number | null;
  genres: string[];
  tagline: string | null;
  directors: string[];
  cast: string[];
  /** Directors, up to two writers and three lead actors, with TMDb person ids. */
  people: Person[];
  trailerKey: string | null;
  /** Every flat-rate service streaming it in your region; filter with servicesOn(). */
  providers: { id: number; name: string }[];
  votes: number;
  originalTitle: string;
  backdropPath: string | null;
};

type TmdbDetails = TmdbMovie & {
  runtime: number | null;
  tagline: string | null;
  credits?: { cast: { id: number; name: string }[]; crew: { id: number; name: string; job: string }[] };
  videos?: { results: { key: string; site: string; type: string; official: boolean }[] };
  "watch/providers"?: {
    results: Record<string, { flatrate?: { provider_id: number; provider_name: string }[] }>;
  };
};

export async function getMovieDetails(id: number): Promise<MovieDetails> {
  const d = await tmdb<TmdbDetails>(
    `/movie/${id}`,
    { language: "en-US", append_to_response: "credits,videos,watch/providers" },
    60 * 60 * 6,
  );
  const region = d["watch/providers"]?.results?.[WATCH_REGION];
  const videos = d.videos?.results ?? [];
  const trailer =
    videos.find((v) => v.site === "YouTube" && v.type === "Trailer" && v.official) ??
    videos.find((v) => v.site === "YouTube" && v.type === "Trailer");
  const base = toCandidate(d, false);
  return {
    id: d.id,
    title: base.title,
    year: base.year,
    language: base.language,
    genreIds: base.genreIds,
    posterPath: base.posterPath,
    rating: Math.round(base.voteAverage * 10) / 10,
    overview: base.overview,
    runtime: d.runtime || null,
    genres: (d.genres ?? []).map((g) => MOVIE_GENRE_NAMES[g.id] ?? g.name),
    tagline: d.tagline || null,
    directors: (d.credits?.crew ?? []).filter((c) => c.job === "Director").map((c) => c.name),
    cast: (d.credits?.cast ?? []).slice(0, 4).map((c) => c.name),
    people: moviePeople(d.credits),
    trailerKey: trailer?.key ?? null,
    providers: (region?.flatrate ?? []).map((p) => ({ id: p.provider_id, name: p.provider_name })),
    votes: base.voteCount,
    originalTitle: base.originalTitle,
    backdropPath: base.backdropPath,
  };
}

/** Directors, up to two writers and the top three billed actors, each once. */
export function moviePeople(credits: TmdbDetails["credits"]): Person[] {
  const crew = credits?.crew ?? [];
  const people: Person[] = [
    ...crew.filter((c) => c.job === "Director").map((c) => ({ source: "tmdb" as const, id: c.id, name: c.name, role: "director" as const })),
    ...crew
      .filter((c) => WRITING_JOBS.has(c.job))
      .slice(0, 2)
      .map((c) => ({ source: "tmdb" as const, id: c.id, name: c.name, role: "writer" as const })),
    ...(credits?.cast ?? []).slice(0, 3).map((c) => ({ source: "tmdb" as const, id: c.id, name: c.name, role: "actor" as const })),
  ];
  const seen = new Set<number>();
  return people.filter((p) => p.id && !seen.has(p.id) && seen.add(p.id));
}
