import type { MoodId } from "@/lib/moods";
import type { GateReason, Language, MovieCandidate, Taps } from "./types";

/*
 * The taste rules, as plain functions so every one is unit-tested. Thresholds
 * come from probing TMDb (Oct 2026), not guesses:
 *
 *   crime/thriller/mystery films by vote floor     20     50    100
 *   Hindi                                          429    224   107
 *   Tamil                                          175     64    19
 *   Malayalam                                      128     27     4
 *
 * One global floor would erase Malayalam, so each language gets its own floor
 * and its own prior for the weighted rating.
 */

export const GENRE = {
  action: 28,
  adventure: 12,
  animation: 16,
  comedy: 35,
  crime: 80,
  documentary: 99,
  drama: 18,
  family: 10751,
  fantasy: 14,
  history: 36,
  horror: 27,
  music: 10402,
  mystery: 9648,
  romance: 10749,
  scifi: 878,
  tvMovie: 10770,
  thriller: 53,
  war: 10752,
  western: 37,
} as const;

export const MOVIE_GENRE_NAMES: Record<number, string> = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Sci-Fi",
  10770: "TV Movie",
  53: "Thriller",
  10752: "War",
  37: "Western",
};

/** Per-language quality model. `C` is the prior mean, `m` its weight in votes. */
export const LANGUAGES: Record<
  Language,
  { minVotes: number; prior: number; priorVotes: number; ubiquitous: number; gated: boolean }
> = {
  // `ubiquitous`: past this many TMDb votes, most people have seen it. TMDb counts
  // run far below IMDb's (Godfather Part II has ~14k), so these are low on purpose.
  en: { minVotes: 300, prior: 6.6, priorVotes: 1500, ubiquitous: 4000, gated: false },
  hi: { minVotes: 40, prior: 6.3, priorVotes: 150, ubiquitous: 1200, gated: true },
  ta: { minVotes: 20, prior: 6.5, priorVotes: 60, ubiquitous: 500, gated: true },
  ml: { minVotes: 20, prior: 6.6, priorVotes: 40, ubiquitous: 300, gated: true },
};

export const MOVIE_LANGUAGES = Object.keys(LANGUAGES) as Language[];

/** The weighted score an Indian film needs to get in on storyline alone. */
export const ACCLAIMED_RATING = 7.2;

/** Genres that let a Tamil, Malayalam or Hindi film in regardless of rating. */
export const GATE_GENRES: readonly number[] = [GENRE.crime, GENRE.thriller, GENRE.mystery];

export function isLanguage(value: string): value is Language {
  return value in LANGUAGES;
}

/**
 * Bayesian weighted rating: a film with few votes is pulled toward its
 * language's typical score until enough votes back it up. This is what stops a
 * week-old release with 400 votes at 9.1 outranking a classic.
 */
export function weightedRating(
  voteAverage: number,
  voteCount: number,
  language: string,
  ageDays = Infinity,
): number {
  const rules = isLanguage(language) ? LANGUAGES[language] : LANGUAGES.en;
  const v = Math.max(0, voteCount);
  // In its first six months a film's fans vote first; trust those votes less.
  const m = rules.priorVotes * (ageDays < FRESH_DAYS ? 4 : 1);
  return (v / (v + m)) * voteAverage + (m / (v + m)) * rules.prior;
}

export const FRESH_DAYS = 180;

export function ageInDays(releaseDate: string | null, today = new Date()): number {
  if (!releaseDate) return Infinity;
  const ms = today.getTime() - new Date(releaseDate).getTime();
  return Number.isFinite(ms) ? Math.max(0, ms / 86_400_000) : Infinity;
}

/** The weighted rating of an actual film, accounting for how new it is. */
export function ratingOf(movie: MovieCandidate): number {
  return weightedRating(movie.voteAverage, movie.voteCount, movie.language, ageInDays(movie.releaseDate));
}

/**
 * Your language rule. English films pass on quality alone. Tamil, Malayalam and
 * Hindi films pass if they're crime, thriller or mystery, or if they're
 * acclaimed. Anything else (other languages, too few votes) is out.
 */
export function passesGate(movie: MovieCandidate): { ok: boolean; reason?: GateReason } {
  if (!isLanguage(movie.language)) return { ok: false };
  const rules = LANGUAGES[movie.language];
  if (movie.voteCount < rules.minVotes) return { ok: false };
  if (!rules.gated) return { ok: true };
  if (movie.genreIds.some((g) => GATE_GENRES.includes(g))) return { ok: true, reason: "crime/thriller" };
  if (ratingOf(movie) >= ACCLAIMED_RATING) {
    return { ok: true, reason: "acclaimed" };
  }
  return { ok: false };
}

/* ------------------------------------------------------------------ moods */

export type MovieMoodRule = {
  /** Any of these makes a film a candidate for the mood (TMDb OR query). */
  genres: number[];
  /**
   * TMDb keyword ids. When set, English pools query these instead of genres:
   * "sci-fi" isn't the same as "mind-bending", but "time loop" is. Indian films
   * are rarely keyword-tagged on TMDb, so their pools keep using genres.
   */
  keywords?: number[];
  /** Genres for Tamil, Malayalam and Hindi pools, when they should differ from `genres`. */
  indianGenres?: number[];
  /** Any of these rules it out. */
  exclude: number[];
  /** Minimum weighted rating; the "moving" and "mind-bending" moods ask for more. */
  minRating: number;
};

export const MOVIE_MOODS: Record<MoodId, MovieMoodRule> = {
  gripping: {
    genres: [GENRE.thriller, GENRE.crime, GENRE.mystery, GENRE.action],
    exclude: [GENRE.family, GENRE.animation, GENRE.documentary, GENRE.tvMovie],
    minRating: 6.6,
  },
  dark: {
    // No plain drama: "dark" and "moving" were the same deck when drama counted.
    genres: [GENRE.crime, GENRE.thriller, GENRE.horror, GENRE.war, GENRE.mystery],
    exclude: [GENRE.comedy, GENRE.family, GENRE.romance, GENRE.music, GENRE.animation, GENRE.documentary, GENRE.tvMovie],
    minRating: 6.8,
  },
  mind: {
    genres: [GENRE.scifi, GENRE.mystery, GENRE.fantasy, GENRE.thriller, GENRE.drama],
    keywords: [
      10854, // time loop
      157171, // nonlinear timeline
      243230, // parallel universe
      174089, // unreliable narrator
      3307, // surreal
      346773, // dream
      2423, // simulation
      181324, // existentialism
      326438, // twist ending
      275311, // plot twist
    ],
    // "Acclaimed drama" isn't mind-bending; keep Indian picks to the twisty genres.
    indianGenres: [GENRE.mystery, GENRE.scifi, GENRE.fantasy],
    exclude: [GENRE.family, GENRE.documentary, GENRE.tvMovie],
    minRating: 6.9,
  },
  funny: {
    genres: [GENRE.comedy],
    // Family comedies swamped this deck (8 of 15 were animated kids' films). No crime or
    // thrillers either: TMDb files dark crime films like Aaranya Kaandam as comedies too.
    exclude: [GENRE.family, GENRE.horror, GENRE.war, GENRE.documentary, GENRE.tvMovie, GENRE.crime, GENRE.thriller],
    minRating: 6.9,
  },
  feelgood: {
    // No romance: sad romances (All the Bright Places) were slipping in.
    genres: [GENRE.comedy, GENRE.family, GENRE.music, GENRE.adventure],
    exclude: [GENRE.horror, GENRE.thriller, GENRE.crime, GENRE.war, GENRE.documentary, GENRE.tvMovie],
    minRating: 6.7,
  },
  moving: {
    genres: [GENRE.drama],
    exclude: [GENRE.crime, GENRE.thriller, GENRE.action, GENRE.horror, GENRE.documentary, GENRE.tvMovie, GENRE.animation],
    minRating: 7.1,
  },
  romantic: {
    genres: [GENRE.romance],
    exclude: [GENRE.horror, GENRE.war, GENRE.documentary, GENRE.tvMovie, GENRE.animation],
    minRating: 6.6,
  },
};

/** Never films: stand-up specials and concert films, which TMDb files as comedy or music. */
export const EXCLUDED_KEYWORDS: readonly number[] = [
  9716, // stand-up comedy
  356038, // stand-up specials
  156205, // concert film
];

/** How strongly a film fits the mood: the share of its genres the mood asked for, plus a little for any match. */
/** A genre the mood never deals (Funny: no crime or thrillers), whatever else fits. */
export function moodExcludes(movie: MovieCandidate, mood: MoodId): boolean {
  return movie.genreIds.some((g) => MOVIE_MOODS[mood].exclude.includes(g));
}

export function moodFit(movie: MovieCandidate, mood: MoodId): number {
  const rule = MOVIE_MOODS[mood];
  if (moodExcludes(movie, mood)) return 0;
  const hits = movie.genreIds.filter((g) => rule.genres.includes(g)).length;
  if (hits === 0) return 0;
  return Math.min(1, 0.5 + hits / Math.max(2, movie.genreIds.length));
}

/* ----------------------------------------------------------- energy, time */

const INTENSE = new Set<number>([GENRE.thriller, GENRE.action, GENRE.horror, GENRE.war, GENRE.crime, GENRE.mystery]);
const GENTLE = new Set<number>([GENRE.comedy, GENRE.family, GENRE.romance, GENRE.music, GENRE.animation]);

/** 0 = gentle, 1 = middling, 2 = intense, estimated from genres. */
export function intensity(movie: MovieCandidate): number {
  const intense = movie.genreIds.filter((g) => INTENSE.has(g)).length;
  const gentle = movie.genreIds.filter((g) => GENTLE.has(g)).length;
  if (intense > gentle) return 2;
  if (gentle > intense) return 0;
  return 1;
}

/** 1 when intensity matches the energy you asked for, falling off with distance. */
export function energyFit(movie: MovieCandidate, energy: Taps["energy"]): number {
  return [1, 0.45, 0][Math.abs(intensity(movie) - energy)];
}

/** Runtime ceiling per time choice, for the TMDb query. Null means no limit. */
export const RUNTIME_LIMIT: Record<Taps["time"], number | null> = { 0: 100, 1: 140, 2: null };

/**
 * Whether a film fits the time you chose. Discover pools filter on runtime
 * themselves, but films added from elsewhere (people you follow, books you've
 * read) don't, so every film is checked once its details are in. An unknown
 * runtime is kept: it's rare once details are fetched.
 */
export function fitsRuntime(runtime: number | null | undefined, time: Taps["time"]): boolean {
  const limit = RUNTIME_LIMIT[time];
  return limit === null || runtime == null || runtime <= limit;
}

/* ----------------------------------------------------------------- scoring */

/**
 * Past roughly the "everyone has seen it" mark, a film gets marked down. Not
 * excluded: a great famous film can still win on mood and quality.
 */
export function mainstreamPenalty(movie: MovieCandidate): number {
  const rules = isLanguage(movie.language) ? LANGUAGES[movie.language] : LANGUAGES.en;
  const ratio = movie.voteCount / rules.ubiquitous;
  if (ratio <= 1) return 0;
  return Math.min(0.3, 0.1 * Math.log2(ratio) + 0.06);
}

/** Taste learned from your swipes: genre and language affinities in [-1, 1]. */
export type TasteProfile = { tags: Record<string, number> };
export const NO_TASTE: TasteProfile = { tags: {} };

export function tasteFit(movie: MovieCandidate, taste: TasteProfile): number {
  const tags = [...movie.genreIds.map(String), `lang:${movie.language}`];
  const values = tags.map((t) => taste.tags[t] ?? 0);
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

export const WEIGHTS = {
  quality: 0.38,
  mood: 0.3,
  energy: 0.14,
  taste: 0.1,
  services: 0.08,
} as const;

/**
 * One number per film. Quality is the weighted rating rescaled so 6 → 0 and
 * 8.5 → 1. There is deliberately no raw-popularity term: v1 ranked 30% on
 * popularity and served blockbusters.
 */
export function scoreMovie(movie: MovieCandidate, taps: Taps, taste: TasteProfile = NO_TASTE): number {
  const wr = ratingOf(movie);
  const quality = Math.min(1, Math.max(0, (wr - 6) / 2.5));
  return (
    WEIGHTS.quality * quality +
    WEIGHTS.mood * moodFit(movie, taps.mood) +
    WEIGHTS.energy * energyFit(movie, taps.energy) +
    WEIGHTS.taste * ((tasteFit(movie, taste) + 1) / 2) +
    WEIGHTS.services * (movie.onMyServices ? 1 : 0) -
    mainstreamPenalty(movie)
  );
}

/** Whether a film can be dealt at all for these taps. */
export function eligible(movie: MovieCandidate, taps: Taps): boolean {
  if (!passesGate(movie).ok) return false;
  if (moodFit(movie, taps.mood) === 0) return false;
  return ratingOf(movie) >= MOVIE_MOODS[taps.mood].minRating;
}

/** At most this many animated films per deck, whatever the mood. */
export const MAX_ANIMATED = 2;
