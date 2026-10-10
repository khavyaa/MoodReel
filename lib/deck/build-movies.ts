import "server-only";
import { composeDeck, DECK_SIZE } from "./compose";
import { applyCuration } from "./curation";
import { curateWithAi } from "@/lib/ai/curate";
import { discoverMovies, getMovieDetails, type DiscoverQuery } from "@/lib/tmdb/movies";
import { servicesOn } from "@/lib/tmdb/providers";
import type { SeriesFacts } from "@/lib/taste/series-rules";
import {
  GENRE,
  LANGUAGES,
  MAX_ANIMATED,
  MOVIE_LANGUAGES,
  MOVIE_MOODS,
  RUNTIME_LIMIT,
  eligible,
  passesGate,
  scoreMovie,
  type TasteProfile,
} from "@/lib/taste/rules";
import { LANGUAGE_LABEL, type GateReason, type Language, type MovieCandidate, type Taps } from "@/lib/taste/types";

/** Everything a card shows. Sent to the browser, so nothing secret goes in here. */
export type DeckCard = {
  media: "movie" | "series";
  id: number;
  title: string;
  originalTitle: string;
  year: number | null;
  language: string;
  languageLabel: string;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  rating: number;
  votes: number;
  genreIds: number[];
  genres: string[];
  runtime: number | null;
  directors: string[];
  cast: string[];
  streamingOn: string[];
  gate: GateReason | null;
  trailerKey: string | null;
  /** Seasons, episodes, still airing: series only. */
  series: SeriesFacts | null;
};

/**
 * Which pool queries to run per language. English gets more (it's most of the
 * deck), including "well rated, fewer votes" pools so the deck isn't just the
 * films everyone has already seen.
 */
export function poolQueries(language: Language, taps: Taps, providers: number[]): DiscoverQuery[] {
  const rule = MOVIE_MOODS[taps.mood];
  const rules = LANGUAGES[language];
  const base = {
    language,
    genres: language === "en" ? rule.genres : (rule.indianGenres ?? rule.genres),
    // Keyword pools only for English: TMDb rarely keyword-tags Indian films.
    keywords: language === "en" ? rule.keywords : undefined,
    excludeGenres: rule.exclude,
    minVotes: rules.minVotes,
    runtimeMax: RUNTIME_LIMIT[taps.time],
  };
  const mine = { providers };
  const anywhere = { providers: [] as number[] };
  if (language !== "en") {
    return [
      { ...base, ...mine, sortBy: "vote_average.desc", page: 1 },
      { ...base, ...mine, sortBy: "popularity.desc", page: 1 },
      { ...base, ...anywhere, sortBy: "vote_average.desc", page: 1 },
    ];
  }
  const lesserSeen = { ...base, maxVotes: rules.ubiquitous };
  return [
    { ...lesserSeen, ...mine, sortBy: "vote_average.desc", page: 1 },
    { ...lesserSeen, ...mine, sortBy: "vote_average.desc", page: 2 },
    { ...lesserSeen, ...anywhere, sortBy: "vote_average.desc", page: 1 },
    { ...base, ...mine, sortBy: "vote_average.desc", page: 1 },
    { ...base, ...mine, sortBy: "popularity.desc", page: 1 },
  ];
}

/** Keeps only the best few animated films so no deck turns into a kids' lineup. */
export function capAnimated<T extends { movie: MovieCandidate; score: number }>(scored: T[], max = MAX_ANIMATED): T[] {
  const animated = scored
    .filter((s) => s.movie.genreIds.includes(GENRE.animation))
    .sort((a, b) => b.score - a.score)
    .slice(0, max);
  const keep = new Set(animated.map((s) => s.movie.id));
  return scored.filter((s) => !s.movie.genreIds.includes(GENRE.animation) || keep.has(s.movie.id));
}

export type DealResult = {
  cards: DeckCard[];
  /** Languages whose queries all failed, so the deck is missing them. */
  missingLanguages: string[];
  /** Whether an AI pass re-weighted this deck (false: rules only). */
  curatedByAi: boolean;
};

/** How many of the best-scoring candidates the AI is asked about. */
const CURATE_TOP = 30;

export async function buildMovieDeck(
  taps: Taps,
  {
    exclude,
    taste,
    seed,
    providers,
  }: { exclude: Set<number>; taste: TasteProfile; seed: number; providers: number[] },
): Promise<DealResult> {
  const queries = MOVIE_LANGUAGES.flatMap((language) =>
    poolQueries(language, taps, providers)
      // With no services ticked, the services-only pools repeat the open ones.
      .filter((q, i, all) => all.findIndex((o) => JSON.stringify(o) === JSON.stringify(q)) === i)
      .map((q) => ({ language, q })),
  );
  const results = await Promise.allSettled(queries.map(({ q }) => discoverMovies(q)));

  const pool = new Map<number, MovieCandidate>();
  const succeeded = new Set<string>();
  results.forEach((r, i) => {
    if (r.status !== "fulfilled") return;
    succeeded.add(queries[i].language);
    for (const movie of r.value) {
      const existing = pool.get(movie.id);
      // A film found by any services-only query is streamable for you.
      pool.set(movie.id, existing ? { ...existing, onMyServices: existing.onMyServices || movie.onMyServices } : movie);
    }
  });
  if (succeeded.size === 0) {
    const firstError = results.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
    throw firstError?.reason ?? new Error("TMDb returned nothing.");
  }

  const candidates = [...pool.values()].filter((m) => !exclude.has(m.id) && eligible(m, taps));
  const scored = capAnimated(candidates.map((movie) => ({ movie, score: scoreMovie(movie, taps, taste) })));

  // AI gets a say on the strongest candidates; the rules still compose the deck.
  const top = [...scored].sort((a, b) => b.score - a.score).slice(0, CURATE_TOP).map((s) => s.movie);
  const approved = await curateWithAi(taps, top);
  const deck = composeDeck(applyCuration(scored, approved, new Set(top.map((m) => m.id))), {
    size: DECK_SIZE,
    seed,
  });

  const details = await Promise.allSettled(deck.map((m) => getMovieDetails(m.id)));
  const cards = deck.map((m, i): DeckCard => {
    const d = details[i].status === "fulfilled" ? details[i].value : null;
    return {
      media: "movie",
      id: m.id,
      title: m.title,
      originalTitle: m.originalTitle,
      year: m.year,
      language: m.language,
      languageLabel: LANGUAGE_LABEL[m.language] ?? m.language.toUpperCase(),
      overview: m.overview,
      posterPath: m.posterPath,
      backdropPath: m.backdropPath,
      rating: Math.round(m.voteAverage * 10) / 10,
      votes: m.voteCount,
      genreIds: m.genreIds,
      genres: d?.genres ?? [],
      runtime: d?.runtime ?? null,
      directors: d?.directors ?? [],
      cast: d?.cast ?? [],
      // Details know exactly which service; the pool flag is the fallback.
      streamingOn: d ? servicesOn(d.providers, providers) : m.onMyServices ? ["your services"] : [],
      gate: passesGate(m).reason ?? null,
      trailerKey: d?.trailerKey ?? null,
      series: null,
    };
  });

  return {
    cards,
    missingLanguages: MOVIE_LANGUAGES.filter((l) => !succeeded.has(l)).map((l) => LANGUAGE_LABEL[l] ?? l),
    curatedByAi: approved !== null,
  };
}
