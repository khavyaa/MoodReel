import "server-only";
import type { CastMember, MovieCard, MovieDetails } from "@/lib/types";
import type { MoodPreset } from "@/lib/recommendations/mood-presets";

const TMDB_BASE = "https://api.themoviedb.org/3";

/** Thrown for any non-2xx TMDb response so routes can map it to a status code. */
export class TmdbError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** Whether retrying the same request could plausibly succeed. */
    readonly retryable = false,
  ) {
    super(message);
    this.name = "TmdbError";
  }
}

export function tmdbConfigured() {
  return Boolean(process.env.TMDB_ACCESS_TOKEN);
}

type TmdbFetchOptions = {
  /** Seconds. TMDb terms discourage indefinite caching, so keep these short. */
  revalidate?: number;
};

/**
 * Connections to TMDb drop often enough (ECONNRESET on a cold connection, the
 * occasional 429/5xx) that a single failure is not evidence of a real problem.
 * Without retries a dropped request silently removes a whole language from a
 * deck, so transient failures are retried before they are believed.
 */
const MAX_ATTEMPTS = 3;
const RETRY_BASE_MS = 150;

function isRetryableStatus(status: number) {
  return status === 429 || status >= 500;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function tmdbFetch<T>(
  path: string,
  params: Record<string, string | number | undefined> = {},
  options: TmdbFetchOptions = {},
): Promise<T> {
  const token = process.env.TMDB_ACCESS_TOKEN;
  if (!token) {
    throw new TmdbError("TMDB_ACCESS_TOKEN is not configured on the server.", 503);
  }

  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  const url = `${TMDB_BASE}${path}${search.size ? `?${search.toString()}` : ""}`;

  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, accept: "application/json" },
        next: { revalidate: options.revalidate ?? 60 * 30 },
      });

      if (res.ok) return (await res.json()) as T;

      const body = await res.text().catch(() => "");
      throw new TmdbError(
        `TMDb request failed (${res.status}) for ${path}${body ? `: ${body.slice(0, 200)}` : ""}`,
        // A bad token is a configuration problem, not a transient one.
        res.status === 401 ? 503 : 502,
        isRetryableStatus(res.status),
      );
    } catch (error) {
      // Network-level failures (ECONNRESET, DNS, timeouts) are always worth a retry;
      // TmdbErrors carry their own verdict.
      const retryable = error instanceof TmdbError ? error.retryable : true;
      if (!retryable) throw error;

      if (attempt === MAX_ATTEMPTS) {
        throw error instanceof TmdbError
          ? error
          : new TmdbError(
              `TMDb request failed for ${path} after ${MAX_ATTEMPTS} attempts: ${
                error instanceof Error ? error.message : String(error)
              }`,
              502,
              true,
            );
      }
      lastError = error;
    }

    // Exponential backoff with jitter, so parallel language fetches do not
    // retry in lockstep and hit TMDb as a burst.
    await sleep(RETRY_BASE_MS * 2 ** (attempt - 1) + Math.random() * 100);
  }

  throw lastError instanceof TmdbError
    ? lastError
    : new TmdbError(`TMDb request failed for ${path}.`, 502);
}

/* ------------------------------------------------------------------ genres */

type TmdbGenre = { id: number; name: string };

let genreCache: { at: number; map: Map<number, string> } | null = null;
const GENRE_TTL_MS = 1000 * 60 * 60 * 12;

export async function getGenreMap(): Promise<Map<number, string>> {
  if (genreCache && Date.now() - genreCache.at < GENRE_TTL_MS) return genreCache.map;
  const data = await tmdbFetch<{ genres: TmdbGenre[] }>(
    "/genre/movie/list",
    { language: "en-US" },
    { revalidate: 60 * 60 * 24 },
  );
  const map = new Map(data.genres.map((g) => [g.id, g.name]));
  genreCache = { at: Date.now(), map };
  return map;
}

/* ------------------------------------------------------------- normalizing */

export type TmdbMovie = {
  id: number;
  title: string;
  original_title: string;
  overview: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  original_language: string;
  genre_ids?: number[];
  genres?: TmdbGenre[];
  vote_average: number;
  vote_count: number;
  popularity: number;
  release_date: string | null;
  runtime?: number | null;
};

export function toMovieCard(movie: TmdbMovie, genreMap: Map<number, string>): MovieCard {
  const genreIds = movie.genres?.map((g) => g.id) ?? movie.genre_ids ?? [];
  const year = movie.release_date ? Number(movie.release_date.slice(0, 4)) : null;
  return {
    id: movie.id,
    title: movie.title,
    originalTitle: movie.original_title,
    year: Number.isFinite(year) && year ? year : null,
    overview: movie.overview ?? "",
    posterPath: movie.poster_path,
    backdropPath: movie.backdrop_path,
    language: movie.original_language,
    genreIds,
    genres: genreIds.map((id) => genreMap.get(id)).filter((n): n is string => Boolean(n)),
    voteAverage: movie.vote_average ?? 0,
    voteCount: movie.vote_count ?? 0,
    popularity: movie.popularity ?? 0,
    runtime: movie.runtime ?? null,
  };
}

/* ---------------------------------------------------------------- discover */

export type DiscoverArgs = {
  language: string;
  preset: MoodPreset;
  page: number;
};

/**
 * TMDb's vote counts are dominated by its English-speaking userbase, so one
 * global vote floor is not neutral - it is an English filter. At the classics
 * preset's floor of 300, English returns ~1000 titles, Hindi 13, and Tamil
 * zero. Scaling the floor per language keeps the quality gate meaningful for
 * English while letting genuine Hindi and Tamil classics through.
 */
const LANGUAGE_VOTE_SCALE: Record<string, number> = { en: 1, hi: 0.25, ta: 0.15 };

/** Below this, results are mostly unreviewed noise in any language. */
const MIN_VOTE_FLOOR = 20;

export function scaledVoteFloor(language: string, minVoteCount: number | undefined) {
  const scale = LANGUAGE_VOTE_SCALE[language] ?? 1;
  return Math.max(MIN_VOTE_FLOOR, Math.round((minVoteCount ?? 25) * scale));
}

/** Build the TMDb discover query for one language + mood. Exported for tests. */
export function buildDiscoverParams({ language, preset, page }: DiscoverArgs) {
  const params: Record<string, string | number | undefined> = {
    include_adult: "false",
    include_video: "false",
    language: "en-US",
    page,
    sort_by: preset.sortBy ?? "popularity.desc",
    with_original_language: language,
    "vote_count.gte": scaledVoteFloor(language, preset.minVoteCount),
  };
  if (preset.genres.length) params.with_genres = preset.genres.join("|");
  if (preset.excludeGenres?.length) params.without_genres = preset.excludeGenres.join(",");
  if (preset.keywords?.length) params.with_keywords = preset.keywords.join("|");
  if (preset.minVoteAverage) params["vote_average.gte"] = preset.minVoteAverage;
  if (preset.maxVoteAverage) params["vote_average.lte"] = preset.maxVoteAverage;
  if (preset.releaseDateGte) params["primary_release_date.gte"] = preset.releaseDateGte;
  if (preset.releaseDateLte) params["primary_release_date.lte"] = preset.releaseDateLte;
  return params;
}

export async function discoverMovies(args: DiscoverArgs): Promise<MovieCard[]> {
  const genreMap = await getGenreMap();
  const data = await tmdbFetch<{ results: TmdbMovie[] }>(
    "/discover/movie",
    buildDiscoverParams(args),
    { revalidate: 60 * 30 },
  );
  return data.results.map((m) => toMovieCard(m, genreMap));
}

/* ------------------------------------------------------------------ search */

export async function searchMovies(query: string, languages: string[]): Promise<MovieCard[]> {
  const genreMap = await getGenreMap();
  const data = await tmdbFetch<{ results: TmdbMovie[] }>(
    "/search/movie",
    { query, include_adult: "false", language: "en-US", page: 1 },
    { revalidate: 60 * 10 },
  );
  return data.results
    .filter((m) => languages.length === 0 || languages.includes(m.original_language))
    .map((m) => toMovieCard(m, genreMap));
}

/* ----------------------------------------------------------------- details */

type TmdbDetails = TmdbMovie & {
  tagline: string | null;
  status: string;
  credits?: {
    cast: { id: number; name: string; character: string; profile_path: string | null }[];
    crew: { id: number; name: string; job: string }[];
  };
  videos?: { results: { key: string; site: string; type: string; official: boolean }[] };
  similar?: { results: TmdbMovie[] };
  "watch/providers"?: {
    results: Record<
      string,
      { link?: string; flatrate?: { provider_name: string; logo_path: string | null }[] }
    >;
  };
};

export async function getMovieDetails(
  tmdbId: number,
  watchRegion = "IN",
): Promise<MovieDetails> {
  const genreMap = await getGenreMap();
  const data = await tmdbFetch<TmdbDetails>(
    `/movie/${tmdbId}`,
    { language: "en-US", append_to_response: "credits,videos,similar,watch/providers" },
    { revalidate: 60 * 60 * 6 },
  );

  const base = toMovieCard(data, genreMap);
  const cast: CastMember[] = (data.credits?.cast ?? []).slice(0, 12).map((c) => ({
    id: c.id,
    name: c.name,
    character: c.character,
    profilePath: c.profile_path,
  }));
  const directors = (data.credits?.crew ?? [])
    .filter((c) => c.job === "Director")
    .map((c) => c.name);
  const trailer =
    (data.videos?.results ?? []).find(
      (v) => v.site === "YouTube" && v.type === "Trailer" && v.official,
    ) ?? (data.videos?.results ?? []).find((v) => v.site === "YouTube" && v.type === "Trailer");
  const region = data["watch/providers"]?.results?.[watchRegion];

  return {
    ...base,
    runtime: data.runtime ?? null,
    tagline: data.tagline || null,
    status: data.status,
    releaseDate: data.release_date ?? null,
    cast,
    directors,
    trailerKey: trailer?.key ?? null,
    similar: (data.similar?.results ?? []).slice(0, 12).map((m) => toMovieCard(m, genreMap)),
    providers: (region?.flatrate ?? []).map((p) => ({
      name: p.provider_name,
      logoPath: p.logo_path,
    })),
    providerLink: region?.link ?? null,
  };
}

/** Batch fetch used by the watchlist / watched grids. */
export async function getMoviesByIds(ids: number[]): Promise<MovieCard[]> {
  const genreMap = await getGenreMap();
  const settled = await Promise.allSettled(
    ids.map((id) =>
      tmdbFetch<TmdbMovie>(`/movie/${id}`, { language: "en-US" }, { revalidate: 60 * 60 * 6 }),
    ),
  );
  return settled
    .filter((r): r is PromiseFulfilledResult<TmdbMovie> => r.status === "fulfilled")
    .map((r) => toMovieCard(r.value, genreMap));
}
