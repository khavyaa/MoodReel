import "server-only";
import { tmdb } from "./client";
import { WATCH_REGION } from "./movies";
import { NEVER_SERIES_GENRES, SERIES_TYPES, TV_GENRE_NAMES, type SeriesFacts } from "@/lib/taste/series-rules";
import type { MovieCandidate } from "@/lib/taste/types";

/*
 * TMDb TV. Shows come back with `name` and `first_air_date` where films have
 * `title` and `release_date`; they're mapped onto the same candidate shape so
 * the deck, curation and finale code is shared.
 */

type TmdbShow = {
  id: number;
  name: string;
  original_name: string;
  original_language: string;
  first_air_date?: string | null;
  genre_ids?: number[];
  genres?: { id: number; name: string }[];
  overview?: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  vote_count: number;
  popularity: number;
};

function toCandidate(s: TmdbShow, onMyServices: boolean): MovieCandidate {
  const year = s.first_air_date ? Number(s.first_air_date.slice(0, 4)) : null;
  return {
    id: s.id,
    title: s.name,
    originalTitle: s.original_name,
    language: s.original_language,
    year: year && Number.isFinite(year) ? year : null,
    releaseDate: s.first_air_date || null,
    genreIds: s.genre_ids ?? s.genres?.map((g) => g.id) ?? [],
    overview: s.overview ?? "",
    posterPath: s.poster_path,
    backdropPath: s.backdrop_path,
    voteAverage: s.vote_average ?? 0,
    voteCount: s.vote_count ?? 0,
    popularity: s.popularity ?? 0,
    onMyServices,
  };
}

export type SeriesQuery = {
  language: string;
  genres: number[];
  /** When set, query these keywords (any of) instead of genres. */
  keywords?: number[];
  withoutKeywords?: number[];
  exclude: number[];
  minVotes: number;
  maxVotes?: number;
  providers: number[];
  /** Only TMDb "Miniseries"-type shows. */
  miniseriesOnly?: boolean;
  sortBy: "vote_average.desc" | "popularity.desc";
  page: number;
};

/** Exported for tests: the exact TMDb parameters for one pool query. */
export function seriesDiscoverParams(q: SeriesQuery, today = new Date().toISOString().slice(0, 10)) {
  return {
    include_adult: false,
    language: "en-US",
    with_original_language: q.language,
    ...(q.keywords?.length ? { with_keywords: q.keywords.join("|") } : { with_genres: q.genres.join("|") }),
    without_keywords: q.withoutKeywords?.length ? q.withoutKeywords.join(",") : undefined,
    without_genres: [...new Set([...NEVER_SERIES_GENRES, ...q.exclude])].join(","),
    with_type: q.miniseriesOnly ? "2" : SERIES_TYPES.join("|"),
    "vote_count.gte": q.minVotes,
    "vote_count.lte": q.maxVotes,
    "first_air_date.lte": today, // on air, not announced
    sort_by: q.sortBy,
    page: q.page,
    ...(q.providers.length
      ? { with_watch_providers: q.providers.join("|"), watch_region: WATCH_REGION, with_watch_monetization_types: "flatrate" }
      : {}),
  };
}

export async function discoverSeries(q: SeriesQuery): Promise<MovieCandidate[]> {
  const data = await tmdb<{ results: TmdbShow[] }>("/discover/tv", seriesDiscoverParams(q), 60 * 60 * 6);
  return data.results.map((s) => toCandidate(s, q.providers.length > 0));
}

/* ---------------------------------------------------------------- details */

export type SeriesDetails = {
  id: number;
  title: string;
  originalTitle: string;
  year: number | null;
  language: string;
  genreIds: number[];
  genres: string[];
  posterPath: string | null;
  backdropPath: string | null;
  rating: number;
  votes: number;
  overview: string;
  creators: string[];
  cast: string[];
  trailerKey: string | null;
  providers: { id: number; name: string }[];
  facts: SeriesFacts;
  candidate: MovieCandidate;
};

type TmdbShowDetails = TmdbShow & {
  number_of_seasons?: number;
  number_of_episodes?: number;
  episode_run_time?: number[];
  status?: string;
  type?: string;
  in_production?: boolean;
  last_episode_to_air?: { runtime?: number | null } | null;
  seasons?: { season_number: number; episode_count: number }[];
  created_by?: { name: string }[];
  credits?: { cast: { name: string }[] };
  videos?: { results: { key: string; site: string; type: string; official: boolean }[] };
  "watch/providers"?: { results: Record<string, { flatrate?: { provider_id: number; provider_name: string }[] }> };
};

/** Shows still making seasons. TMDb's statuses: Returning Series, Ended, Canceled, In Production, Planned, Pilot. */
const ONGOING = new Set(["Returning Series", "In Production", "Planned"]);

export function seriesFacts(d: TmdbShowDetails): SeriesFacts {
  const typical = d.episode_run_time?.find((m) => m > 0) ?? d.last_episode_to_air?.runtime ?? null;
  const first = d.seasons?.find((s) => s.season_number === 1);
  return {
    seasons: d.number_of_seasons ?? 0,
    episodes: d.number_of_episodes ?? 0,
    firstSeasonEpisodes: first?.episode_count ?? null,
    episodeRuntime: typical && typical > 0 ? typical : null,
    ongoing: ONGOING.has(d.status ?? ""),
    miniseries: d.type === "Miniseries",
  };
}

export async function getSeriesDetails(id: number): Promise<SeriesDetails> {
  const d = await tmdb<TmdbShowDetails>(
    `/tv/${id}`,
    { language: "en-US", append_to_response: "credits,videos,watch/providers" },
    60 * 60 * 6,
  );
  const region = d["watch/providers"]?.results?.[WATCH_REGION];
  const videos = d.videos?.results ?? [];
  const trailer =
    videos.find((v) => v.site === "YouTube" && v.type === "Trailer" && v.official) ??
    videos.find((v) => v.site === "YouTube" && v.type === "Trailer");
  const candidate = toCandidate(d, false);
  return {
    id: d.id,
    title: candidate.title,
    originalTitle: candidate.originalTitle,
    year: candidate.year,
    language: candidate.language,
    genreIds: candidate.genreIds,
    genres: (d.genres ?? []).map((g) => TV_GENRE_NAMES[g.id] ?? g.name),
    posterPath: candidate.posterPath,
    backdropPath: candidate.backdropPath,
    rating: Math.round(candidate.voteAverage * 10) / 10,
    votes: candidate.voteCount,
    overview: candidate.overview,
    creators: (d.created_by ?? []).map((c) => c.name),
    cast: (d.credits?.cast ?? []).slice(0, 4).map((c) => c.name),
    trailerKey: trailer?.key ?? null,
    providers: (region?.flatrate ?? []).map((p) => ({ id: p.provider_id, name: p.provider_name })),
    facts: seriesFacts(d),
    candidate,
  };
}
