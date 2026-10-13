import "server-only";
import { composeDeck, DECK_SIZE } from "./compose";
import { applyCuration } from "./curation";
import { curateWithAi } from "@/lib/ai/curate";
import { discoverMovies, getMovieDetails, type DiscoverQuery, type MovieDetails } from "@/lib/tmdb/movies";
import { FOLLOW_BOOST, NO_PEOPLE, applyPeople, capFollowed, followedIn, type PeopleFilter } from "@/lib/people/rules";
import { servicesOn } from "@/lib/tmdb/providers";
import type { SeriesFacts } from "@/lib/taste/series-rules";
import type { Person } from "@/lib/people/types";
import {
  BASED_ON_BOOK,
  MAX_FROM_READ,
  NO_ADAPT,
  capFromBooks,
  keepAdaptations,
  type AdaptFilter,
  type TitleLink,
} from "@/lib/adaptations/rules";
import {
  GENRE,
  LANGUAGES,
  MAX_ANIMATED,
  MOVIE_LANGUAGES,
  MOVIE_MOODS,
  RUNTIME_LIMIT,
  eligible,
  mainstreamPenalty,
  passesGate,
  scoreMovie,
  type TasteProfile,
} from "@/lib/taste/rules";
import { LANGUAGE_LABEL, type GateReason, type Language, type MovieCandidate, type Taps } from "@/lib/taste/types";

/** Everything a card shows. Sent to the browser, so nothing secret goes in here. */
export type DeckCard = {
  media: "movie" | "series" | "book";
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
  /** Directors, writers, lead actors or authors, with ids for their pages. */
  people: Person[];
  streamingOn: string[];
  gate: GateReason | null;
  trailerKey: string | null;
  /** Seasons, episodes, still airing: series only. */
  series: SeriesFacts | null;
  /** A followed person on this title, for the card's badge. */
  followedName?: string | null;
  /** Authors, pages, NYT weeks: books only. Ratings are then Open Library's, out of 5. */
  book: BookFacts | null;
  /** The book it's based on, or a book's film or series. */
  link?: TitleLink | null;
};

export type BookFacts = {
  authors: string[];
  pages: number | null;
  nytWeeks: number;
  subjects: string[];
  /** Taste tags from the subjects, sent back with each swipe. */
  tags: string[];
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

/** "Adaptations only": films TMDb tags as based on a book, in the mood's genres, anywhere. */
export function adaptationQueries(language: Language, taps: Taps): DiscoverQuery[] {
  const rule = MOVIE_MOODS[taps.mood];
  const base = {
    language,
    genres: language === "en" ? rule.genres : (rule.indianGenres ?? rule.genres),
    keywords: [BASED_ON_BOOK],
    excludeGenres: rule.exclude,
    minVotes: LANGUAGES[language].minVotes,
    runtimeMax: RUNTIME_LIMIT[taps.time],
    providers: [] as number[],
  };
  return [
    { ...base, sortBy: "vote_average.desc", page: 1 },
    { ...base, sortBy: "vote_average.desc", page: 2 },
    { ...base, sortBy: "popularity.desc", page: 1 },
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

/** Candidates whose details (runtime, people, services) are fetched before the deck is composed. */
const DETAIL_TOP = { en: 32, other: 20 } as const;

export function movieCard(m: MovieCandidate, d: MovieDetails | null, providers: number[], followedName: string | null = null): DeckCard {
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
    people: d?.people ?? [],
    // Details know exactly which service; the pool flag is the fallback.
    streamingOn: d ? servicesOn(d.providers, providers) : m.onMyServices ? ["your services"] : [],
    gate: passesGate(m).reason ?? null,
    trailerKey: d?.trailerKey ?? null,
    series: null,
    book: null,
    followedName,
  };
}

/** Details for many films at once; a film TMDb can't return right now is simply missing. */
export async function detailsById(ids: number[]): Promise<Map<number, MovieDetails>> {
  const settled = await Promise.allSettled(ids.map((id) => getMovieDetails(id)));
  const found = new Map<number, MovieDetails>();
  settled.forEach((r) => r.status === "fulfilled" && found.set(r.value.id, r.value));
  return found;
}

export async function buildMovieDeck(
  taps: Taps,
  {
    exclude,
    taste,
    seed,
    providers,
    people = NO_PEOPLE,
    extra = [],
    adapt = NO_ADAPT,
    adaptExtra = [],
  }: {
    exclude: Set<number>;
    taste: TasteProfile;
    seed: number;
    providers: number[];
    people?: PeopleFilter;
    /** Followed people's films, added to the pool. */
    extra?: MovieCandidate[];
    /** Links to books, and how much each film moves from its book. */
    adapt?: AdaptFilter;
    /** Films of books you've read, added to the pool. */
    adaptExtra?: MovieCandidate[];
  },
): Promise<DealResult> {
  const queries = MOVIE_LANGUAGES.flatMap((language) =>
    [...poolQueries(language, taps, providers), ...(adapt.only ? adaptationQueries(language, taps) : [])]
      // With no services ticked, the services-only pools repeat the open ones.
      .filter((q, i, all) => all.findIndex((o) => JSON.stringify(o) === JSON.stringify(q)) === i)
      .map((q) => ({ language, q })),
  );
  const results = await Promise.allSettled(queries.map(({ q }) => discoverMovies(q)));

  const pool = new Map<number, MovieCandidate>();
  const succeeded = new Set<string>();
  const taggedAsBook = new Set<number>();
  results.forEach((r, i) => {
    if (r.status !== "fulfilled") return;
    succeeded.add(queries[i].language);
    for (const movie of r.value) {
      if (queries[i].q.keywords?.includes(BASED_ON_BOOK)) taggedAsBook.add(movie.id);
      const existing = pool.get(movie.id);
      // A film found by any services-only query is streamable for you.
      pool.set(movie.id, existing ? { ...existing, onMyServices: existing.onMyServices || movie.onMyServices } : movie);
    }
  });
  if (succeeded.size === 0) {
    const firstError = results.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
    throw firstError?.reason ?? new Error("TMDb returned nothing.");
  }
  for (const movie of [...extra, ...adaptExtra]) if (!pool.has(movie.id)) pool.set(movie.id, movie);

  const candidates = keepAdaptations(
    [...pool.values()].filter((m) => !exclude.has(m.id) && eligible(m, taps)),
    (m) => m.id,
    adapt,
    taggedAsBook,
  );
  // Followed people's films, and films of books you've read, get their boost
  // now, or famous ones would be cut before their details are fetched. They
  // also skip the "everyone has seen it" markdown: for those, famous is fine.
  const extraIds = new Set(extra.map((m) => m.id));
  const followBonus = (m: MovieCandidate) => {
    const fromBook = adapt.bonus.get(m.id) ?? 0;
    const wanted = extraIds.has(m.id) || fromBook > 0;
    return (extraIds.has(m.id) ? FOLLOW_BOOST : 0) + fromBook + (wanted ? mainstreamPenalty(m) : 0);
  };
  const ranked = capAnimated(
    candidates.map((movie) => ({ movie, score: scoreMovie(movie, taps, taste) + followBonus(movie) })),
  ).sort((a, b) => b.score - a.score);

  // Who made and stars in a film is only in its details, so the best candidates
  // of each language get theirs before the deck is composed: avoided people's
  // films drop out here, followed people's rank higher.
  const shortlist = [
    ...ranked.filter((r) => r.movie.language === "en").slice(0, DETAIL_TOP.en),
    ...ranked.filter((r) => r.movie.language !== "en").slice(0, DETAIL_TOP.other),
  ];
  const details = await detailsById(shortlist.map((s) => s.movie.id));
  const peopleOf = (id: number) => details.get(id)?.people ?? null;
  // Films of books you've read: only the best few, so they don't fill every deck.
  const scored = capFromBooks(
    capFollowed(
      applyPeople(shortlist, (s) => peopleOf(s.movie.id), people, (s) => extraIds.has(s.movie.id)).sort((a, b) => b.score - a.score),
      (s) => followedIn(peopleOf(s.movie.id) ?? [], people),
    ),
    (s) => (adapt.bonus.get(s.movie.id) ?? 0) > 0,
    adapt.only ? MAX_FROM_READ.only : MAX_FROM_READ.mixed,
  );

  // AI gets a say on the strongest candidates; the rules still compose the deck.
  const top = [...scored].sort((a, b) => b.score - a.score).slice(0, CURATE_TOP).map((s) => s.movie);
  const approved = await curateWithAi(taps, top);
  const deck = composeDeck(applyCuration(scored, approved, new Set(top.map((m) => m.id))), {
    size: DECK_SIZE,
    seed,
  });

  return {
    cards: deck.map((m) => {
      const d = details.get(m.id) ?? null;
      return movieCard(m, d, providers, d ? followedIn(d.people, people) : null);
    }),
    missingLanguages: MOVIE_LANGUAGES.filter((l) => !succeeded.has(l)).map((l) => LANGUAGE_LABEL[l] ?? l),
    curatedByAi: approved !== null,
  };
}
