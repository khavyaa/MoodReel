import "server-only";
import { composeDeck, DECK_SIZE } from "./compose";
import { applyCuration } from "./curation";
import type { DealResult, DeckCard } from "./build-movies";
import { curateWithAi } from "@/lib/ai/curate";
import { discoverSeries, getSeriesDetails, type SeriesDetails, type SeriesQuery } from "@/lib/tmdb/series";
import { servicesOn } from "@/lib/tmdb/providers";
import { FOLLOW_BOOST, NO_PEOPLE, applyPeople, capFollowed, followedIn, type PeopleFilter } from "@/lib/people/rules";
import type { TasteProfile } from "@/lib/taste/rules";
import {
  SERIES_ENGLISH_SHARE,
  SERIES_LANGUAGES,
  SERIES_LANGUAGE_LIST,
  SERIES_MOODS,
  fitsCommitment,
  seriesMainstreamPenalty,
  shortEnoughForHindi,
  scoreSeries,
  seriesEligible,
  seriesGate,
  type SeriesLanguage,
  type SeriesMood,
} from "@/lib/taste/series-rules";
import { LANGUAGE_LABEL, type MovieCandidate, type Taps } from "@/lib/taste/types";

export type SeriesTaps = Taps & { mood: SeriesMood };

/**
 * Pool queries per language. English gets "well rated, fewer votes" pools so the
 * deck isn't only the shows everyone has seen; a mini-series night adds pools of
 * TMDb's own "Miniseries" type, which a general query rarely surfaces.
 */
export function seriesPoolQueries(language: SeriesLanguage, taps: SeriesTaps, providers: number[]): SeriesQuery[] {
  const rule = SERIES_MOODS[taps.mood];
  const rules = SERIES_LANGUAGES[language];
  const base = {
    language,
    genres: language === "en" ? rule.genres : (rule.indianGenres ?? rule.genres),
    keywords: language === "en" ? rule.keywords : undefined,
    withoutKeywords: rule.withoutKeywords,
    exclude: rule.exclude,
    minVotes: rules.minVotes,
  };
  const mine = { providers };
  const anywhere = { providers: [] as number[] };
  const minis: SeriesQuery[] =
    taps.time === 0
      ? [
          { ...base, ...anywhere, miniseriesOnly: true, sortBy: "vote_average.desc", page: 1 },
          { ...base, ...mine, miniseriesOnly: true, sortBy: "vote_average.desc", page: 1 },
        ]
      : [];
  if (language === "hi") {
    return [
      { ...base, ...mine, sortBy: "vote_average.desc", page: 1 },
      { ...base, ...mine, sortBy: "popularity.desc", page: 1 },
      { ...base, ...anywhere, sortBy: "vote_average.desc", page: 1 },
      { ...base, ...anywhere, sortBy: "vote_average.desc", page: 2 },
      ...minis,
    ];
  }
  const lesserSeen = { ...base, maxVotes: rules.ubiquitous };
  return [
    { ...lesserSeen, ...mine, sortBy: "vote_average.desc", page: 1 },
    { ...lesserSeen, ...mine, sortBy: "vote_average.desc", page: 2 },
    { ...lesserSeen, ...anywhere, sortBy: "vote_average.desc", page: 1 },
    { ...base, ...mine, sortBy: "vote_average.desc", page: 1 },
    { ...base, ...anywhere, sortBy: "vote_average.desc", page: 1 },
    ...minis,
  ];
}

/** Shows whose details are fetched to check commitment: enough of each language to fill a deck after filtering. */
const DETAIL_POOL = { en: 40, hi: 16 } as const;
const CURATE_TOP = 30;

export function seriesCard(
  d: SeriesDetails,
  providers: number[],
  fallbackOnMine = false,
  followedName: string | null = null,
): DeckCard {
  return {
    media: "series",
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
    runtime: d.facts.episodeRuntime,
    directors: d.creators,
    cast: d.cast,
    people: d.people,
    followedName,
    streamingOn: d.providers.length || !fallbackOnMine ? servicesOn(d.providers, providers) : ["your services"],
    gate: seriesGate(d.candidate).reason ?? null,
    trailerKey: d.trailerKey,
    series: d.facts,
    book: null,
  };
}

export async function buildSeriesDeck(
  taps: SeriesTaps,
  {
    exclude,
    taste,
    seed,
    providers,
    people = NO_PEOPLE,
    extra = [],
  }: {
    exclude: Set<number>;
    taste: TasteProfile;
    seed: number;
    providers: number[];
    people?: PeopleFilter;
    /** Followed people's shows, added to the pool. */
    extra?: MovieCandidate[];
  },
): Promise<DealResult> {
  const queries = SERIES_LANGUAGE_LIST.flatMap((language) =>
    seriesPoolQueries(language, taps, providers)
      .filter((q, i, all) => all.findIndex((o) => JSON.stringify(o) === JSON.stringify(q)) === i)
      .map((q) => ({ language, q })),
  );
  const results = await Promise.allSettled(queries.map(({ q }) => discoverSeries(q)));

  const pool = new Map<number, MovieCandidate>();
  const succeeded = new Set<string>();
  results.forEach((r, i) => {
    if (r.status !== "fulfilled") return;
    succeeded.add(queries[i].language);
    for (const show of r.value) {
      const existing = pool.get(show.id);
      pool.set(show.id, existing ? { ...existing, onMyServices: existing.onMyServices || show.onMyServices } : show);
    }
  });
  if (succeeded.size === 0) {
    const firstError = results.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
    throw firstError?.reason ?? new Error("TMDb returned nothing.");
  }
  for (const show of extra) if (!pool.has(show.id)) pool.set(show.id, show);

  // Rank on what Discover knows, then fetch details for the best of each
  // language: commitment (seasons, episodes) is only in the details.
  const extraIds = new Set(extra.map((s) => s.id));
  // As for films: followed people's shows skip the "everyone has seen it" markdown.
  const followBonus = (s: MovieCandidate) => (extraIds.has(s.id) ? FOLLOW_BOOST + seriesMainstreamPenalty(s) : 0);
  const ranked = [...pool.values()]
    .filter((s) => !exclude.has(s.id) && seriesEligible(s, taps))
    .map((show) => ({ show, score: scoreSeries(show, taps, taste) + followBonus(show) }))
    .sort((a, b) => b.score - a.score);
  const shortlist = SERIES_LANGUAGE_LIST.flatMap((l) => ranked.filter((r) => r.show.language === l).slice(0, DETAIL_POOL[l]));
  const fetched = await Promise.allSettled(shortlist.map((r) => getSeriesDetails(r.show.id)));
  const details = new Map<number, SeriesDetails>();
  fetched.forEach((f) => f.status === "fulfilled" && details.set(f.value.id, f.value));

  const fitting = shortlist.flatMap(({ show }) => {
    const d = details.get(show.id);
    if (!d || !fitsCommitment(d.facts, taps.time) || !shortEnoughForHindi(d.facts, show.language)) return [];
    return [{ movie: show, score: scoreSeries(show, taps, taste, d.facts) + followBonus(show) }];
  });
  // Avoided people's shows drop out; followed people's rank higher.
  const peopleOf = (id: number) => details.get(id)?.people ?? null;
  const scored = capFollowed(
    applyPeople(fitting, (s) => peopleOf(s.movie.id), people, (s) => extraIds.has(s.movie.id)).sort((a, b) => b.score - a.score),
    (s) => followedIn(peopleOf(s.movie.id) ?? [], people),
  );

  const top = [...scored].sort((a, b) => b.score - a.score).slice(0, CURATE_TOP).map((s) => s.movie);
  const approved = await curateWithAi(taps, top, "series");
  const deck = composeDeck(applyCuration(scored, approved, new Set(top.map((m) => m.id))), {
    size: DECK_SIZE,
    englishShare: SERIES_ENGLISH_SHARE,
    seed,
  });

  return {
    cards: deck.map((s) => {
      const d = details.get(s.id)!;
      return seriesCard(d, providers, s.onMyServices, followedIn(d.people, people));
    }),
    missingLanguages: SERIES_LANGUAGE_LIST.filter((l) => !succeeded.has(l)).map((l) => LANGUAGE_LABEL[l] ?? l),
    curatedByAi: approved !== null,
  };
}
