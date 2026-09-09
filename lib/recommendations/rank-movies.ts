import type { MovieCard, MovieActionType } from "@/lib/types";
import {
  HIDDEN_GEM_MAX_POPULARITY,
  type MoodPreset,
} from "@/lib/recommendations/mood-presets";

export type TasteProfile = {
  /** TMDb genre id -> affinity, roughly in [-1, 1]. */
  genreWeights: Record<number, number>;
  /** ISO language code -> affinity, roughly in [-1, 1]. */
  languageWeights: Record<string, number>;
};

export const EMPTY_TASTE: TasteProfile = { genreWeights: {}, languageWeights: {} };

/** How much each action moves affinity. Skips are only mildly negative. */
const ACTION_WEIGHTS: Record<MovieActionType, number> = {
  liked: 1,
  watched: 0.35,
  watchlisted: 0.6,
  skipped: -0.15,
  disliked: -1,
  removed_from_watchlist: -0.3,
};

export type TasteSignal = {
  action: MovieActionType;
  genreIds: number[];
  language: string | null;
};

/**
 * Fold the user's action log into per-genre and per-language affinities.
 * Raw sums are squashed with tanh so a long history cannot dominate the score.
 */
export function buildTasteProfile(signals: TasteSignal[]): TasteProfile {
  const genreSums: Record<number, number> = {};
  const languageSums: Record<string, number> = {};

  for (const signal of signals) {
    const weight = ACTION_WEIGHTS[signal.action] ?? 0;
    if (weight === 0) continue;
    for (const genreId of signal.genreIds ?? []) {
      genreSums[genreId] = (genreSums[genreId] ?? 0) + weight;
    }
    if (signal.language) {
      languageSums[signal.language] = (languageSums[signal.language] ?? 0) + weight;
    }
  }

  const squash = (sums: Record<string | number, number>, divisor: number) =>
    Object.fromEntries(Object.entries(sums).map(([k, v]) => [k, Math.tanh(v / divisor)]));

  return {
    genreWeights: squash(genreSums, 4) as Record<number, number>,
    languageWeights: squash(languageSums, 8) as Record<string, number>,
  };
}

/** Deterministic 0..1 noise so a deck is stable within a session but varies across seeds. */
export function seededRandom(seed: number, id: number) {
  const x = Math.sin(seed * 9301 + id * 49297) * 233280;
  return x - Math.floor(x);
}

const WEIGHTS = {
  popularity: 0.3,
  rating: 0.2,
  mood: 0.3,
  preference: 0.15,
  freshness: 0.05,
};

/** Popularity is unbounded and long-tailed, so compress it before normalising. */
function popularityScore(popularity: number) {
  return Math.min(1, Math.log10(Math.max(popularity, 0) + 1) / 3);
}

export type ScoredMovie = MovieCard & { score: number };

export function scoreMovie(
  movie: MovieCard,
  preset: MoodPreset,
  taste: TasteProfile,
  seed: number,
): number {
  const popularity = popularityScore(movie.popularity);

  // Ratings below ~5 carry no signal for us; treat 5-10 as the useful band.
  const rating = movie.voteAverage <= 5 ? 0 : Math.min(1, (movie.voteAverage - 5) / 5);

  const moodGenres = preset.genres.map(Number);
  const mood = moodGenres.length
    ? Math.min(1, movie.genreIds.filter((id) => moodGenres.includes(id)).length / 2)
    : // Presets without a genre gate (classics, hidden gems) lean on quality instead.
      rating;

  const genreAffinities = movie.genreIds.map((id) => taste.genreWeights[id] ?? 0);
  const genreAffinity = genreAffinities.length
    ? genreAffinities.reduce((a, b) => a + b, 0) / genreAffinities.length
    : 0;
  const languageAffinity = taste.languageWeights[movie.language] ?? 0;
  // Affinities are signed; map [-1, 1] onto [0, 1] so the term never goes negative.
  const preference = (genreAffinity * 0.7 + languageAffinity * 0.3 + 1) / 2;

  const freshness = seededRandom(seed, movie.id);

  let score =
    popularity * WEIGHTS.popularity +
    rating * WEIGHTS.rating +
    mood * WEIGHTS.mood +
    preference * WEIGHTS.preference +
    freshness * WEIGHTS.freshness;

  // "Hidden gems" wants the well-rated but under-watched tail.
  if (preset.id === "hiddenGems" && movie.popularity > HIDDEN_GEM_MAX_POPULARITY) {
    score *= 0.4;
  }

  return score;
}

export function rankMovies(
  movies: MovieCard[],
  preset: MoodPreset,
  taste: TasteProfile = EMPTY_TASTE,
  seed = 1,
): ScoredMovie[] {
  return movies
    .map((movie) => ({ ...movie, score: scoreMovie(movie, preset, taste, seed) }))
    .sort((a, b) => b.score - a.score || a.id - b.id);
}

/** Drop repeat TMDb ids, keeping the first occurrence. */
export function dedupeMovies(movies: MovieCard[]): MovieCard[] {
  const seen = new Set<number>();
  const out: MovieCard[] = [];
  for (const movie of movies) {
    if (seen.has(movie.id)) continue;
    seen.add(movie.id);
    out.push(movie);
  }
  return out;
}

/**
 * Round-robin merge across languages so an "all languages" deck alternates
 * instead of front-loading whichever language TMDb ranks highest.
 */
export function interleaveByLanguage(movies: ScoredMovie[]): ScoredMovie[] {
  const buckets = new Map<string, ScoredMovie[]>();
  for (const movie of movies) {
    const bucket = buckets.get(movie.language) ?? [];
    bucket.push(movie);
    buckets.set(movie.language, bucket);
  }
  const lists = [...buckets.values()];
  const out: ScoredMovie[] = [];
  let index = 0;
  while (out.length < movies.length) {
    let pushed = false;
    for (const list of lists) {
      if (index < list.length) {
        out.push(list[index]);
        pushed = true;
      }
    }
    if (!pushed) break;
    index += 1;
  }
  return out;
}
