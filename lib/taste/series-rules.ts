import type { MoodId } from "@/lib/moods";
import type { GateReason, MovieCandidate, Taps } from "./types";
import { ageInDays, tasteFit, NO_TASTE, type MovieMoodRule, type TasteProfile } from "./rules";

/*
 * Series rules. TMDb's TV genres differ from its film genres (no Thriller,
 * Horror, Romance or Sci-Fi; instead "Action & Adventure", "Sci-Fi & Fantasy",
 * "War & Politics"), and TV ratings run higher than film ratings, so series get
 * their own table. Thresholds from probing TMDb (Oct 2026):
 *
 *   rated 7.2+ (no soap/talk/reality/news/kids)    50+ votes   15+ votes
 *   English                                         1,920       many
 *   Hindi                                              22        ~120
 *
 * Hindi is a small pool, so its floor is low and any genre may come in when
 * it's well rated.
 */

export const TV_GENRE = {
  actionAdventure: 10759,
  animation: 16,
  comedy: 35,
  crime: 80,
  documentary: 99,
  drama: 18,
  family: 10751,
  kids: 10762,
  mystery: 9648,
  news: 10763,
  reality: 10764,
  scifiFantasy: 10765,
  soap: 10766,
  talk: 10767,
  warPolitics: 10768,
  western: 37,
} as const;

export const TV_GENRE_NAMES: Record<number, string> = {
  10759: "Action & Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  10762: "Kids",
  9648: "Mystery",
  10763: "News",
  10764: "Reality",
  10765: "Sci-Fi & Fantasy",
  10766: "Soap",
  10767: "Talk",
  10768: "War & Politics",
  37: "Western",
};

/** Never series: soaps, talk, reality, news, kids' shows, and animation (your call). */
export const NEVER_SERIES_GENRES: readonly number[] = [
  TV_GENRE.soap,
  TV_GENRE.talk,
  TV_GENRE.reality,
  TV_GENRE.news,
  TV_GENRE.kids,
  TV_GENRE.animation,
];

/** TMDb show types allowed: 0 Documentary, 2 Miniseries, 4 Scripted (not news, reality, talk or video). */
export const SERIES_TYPES = [0, 2, 4] as const;

export type SeriesLanguage = "en" | "hi";
export const SERIES_LANGUAGE_LIST: SeriesLanguage[] = ["en", "hi"];

export const SERIES_LANGUAGES: Record<
  SeriesLanguage,
  { minVotes: number; prior: number; priorVotes: number; ubiquitous: number; gated: boolean }
> = {
  en: { minVotes: 100, prior: 7.1, priorVotes: 400, ubiquitous: 3000, gated: false },
  hi: { minVotes: 15, prior: 6.9, priorVotes: 40, ubiquitous: 150, gated: true },
};

export function isSeriesLanguage(value: string): value is SeriesLanguage {
  return value in SERIES_LANGUAGES;
}

/** About one Hindi show in four. */
export const SERIES_ENGLISH_SHARE = 0.75;

/** The weighted rating a Hindi show needs: "well rated", any genre. */
export const HINDI_SERIES_RATING = 7.2;

/** Weighted rating with the series priors; a show in its first six months is trusted less. */
export function seriesRating(show: MovieCandidate): number {
  const rules = isSeriesLanguage(show.language) ? SERIES_LANGUAGES[show.language] : SERIES_LANGUAGES.en;
  const v = Math.max(0, show.voteCount);
  const m = rules.priorVotes * (ageInDays(show.releaseDate) < 180 ? 4 : 1);
  return (v / (v + m)) * show.voteAverage + (m / (v + m)) * rules.prior;
}

/** English passes on quality; Hindi when it's well rated; nothing else. */
export function seriesGate(show: MovieCandidate): { ok: boolean; reason?: GateReason } {
  if (!isSeriesLanguage(show.language)) return { ok: false };
  const rules = SERIES_LANGUAGES[show.language];
  if (show.voteCount < rules.minVotes) return { ok: false };
  if (show.genreIds.some((g) => NEVER_SERIES_GENRES.includes(g))) return { ok: false };
  if (!rules.gated) return { ok: true };
  return seriesRating(show) >= HINDI_SERIES_RATING ? { ok: true, reason: "acclaimed" } : { ok: false };
}

/* ------------------------------------------------------------------ moods */

const G = TV_GENRE;

export type SeriesMoodRule = MovieMoodRule & {
  /** When set, a show must have every genre of at least one of these sets as well. */
  needs?: number[][];
  /** TMDb keywords that rule a show out of this mood's pools. */
  withoutKeywords?: number[];
};

/**
 * Series moods (no "romantic": TMDb has no romance genre for TV). Tuned on live
 * decks: "Sci-Fi & Fantasy" alone made mind-bending a teen-supernatural deck,
 * so English mind-bending pools use story keywords instead, like films do; and
 * `needs` keeps dark apart from gripping and feel-good apart from funny.
 */
export const SERIES_MOODS: Record<Exclude<MoodId, "romantic">, SeriesMoodRule> = {
  gripping: {
    genres: [G.crime, G.mystery, G.actionAdventure, G.warPolitics],
    exclude: [G.family, G.comedy],
    minRating: 7.2,
  },
  dark: {
    genres: [G.crime, G.warPolitics, G.mystery],
    exclude: [G.comedy, G.family, G.documentary, G.actionAdventure, G.scifiFantasy],
    needs: [[G.crime, G.drama], [G.warPolitics], [G.mystery, G.drama]],
    minRating: 7.3,
  },
  mind: {
    genres: [G.scifiFantasy, G.mystery, G.drama, G.crime],
    keywords: [
      10854, // time loop
      4379, // time travel
      4565, // dystopia
      33465, // parallel world
      9678, // mind control
      12565, // psychological thriller
      157171, // nonlinear timeline
      174089, // unreliable narrator
      2423, // simulation
      298544, // mystery box
    ],
    indianGenres: [G.scifiFantasy, G.mystery],
    withoutKeywords: [
      9715, // superhero
      3133, // vampire
      12564, // werewolf
      193400, // teen drama
      6270, // high school
    ],
    exclude: [G.family, G.documentary, G.comedy],
    minRating: 7.3,
  },
  funny: {
    genres: [G.comedy],
    exclude: [G.documentary, G.warPolitics, G.family],
    minRating: 7.2,
  },
  feelgood: {
    genres: [G.family, G.comedy],
    // Warm, not just jokes: a family show, or a comedy that's also a drama.
    needs: [[G.family], [G.comedy, G.drama]],
    exclude: [G.crime, G.warPolitics, G.mystery, G.scifiFantasy],
    minRating: 7.2,
  },
  moving: {
    genres: [G.drama, G.documentary],
    exclude: [G.comedy, G.actionAdventure, G.scifiFantasy, G.crime],
    minRating: 7.4,
  },
};

export type SeriesMood = keyof typeof SERIES_MOODS;
export function isSeriesMood(mood: string): mood is SeriesMood {
  return mood in SERIES_MOODS;
}

export function seriesMoodFit(show: MovieCandidate, mood: SeriesMood): number {
  const rule = SERIES_MOODS[mood];
  if (show.genreIds.some((g) => rule.exclude.includes(g))) return 0;
  if (rule.needs && !rule.needs.some((set) => set.every((g) => show.genreIds.includes(g)))) return 0;
  const hits = show.genreIds.filter((g) => rule.genres.includes(g)).length;
  if (hits === 0) return 0;
  return Math.min(1, 0.5 + hits / Math.max(2, show.genreIds.length));
}

/* ------------------------------------------------- energy and commitment */

const INTENSE = new Set<number>([G.crime, G.actionAdventure, G.warPolitics, G.mystery, G.scifiFantasy]);
const GENTLE = new Set<number>([G.comedy, G.family]);

/** What a show's details add to the card and the commitment check. */
export type SeriesFacts = {
  seasons: number;
  episodes: number;
  /** Episodes in season 1, the first thing you'd commit to. */
  firstSeasonEpisodes: number | null;
  /** Typical episode length in minutes, when TMDb knows it. */
  episodeRuntime: number | null;
  /** More seasons are coming. */
  ongoing: boolean;
  /** TMDb's own "Miniseries" type. */
  miniseries: boolean;
};

/**
 * Energy from genres, nudged by episode length: half-hour episodes suit a
 * lean-back night, hour-long ones a lean-in night.
 */
export function seriesEnergyFit(show: MovieCandidate, energy: Taps["energy"], facts?: SeriesFacts | null): number {
  const intense = show.genreIds.filter((g) => INTENSE.has(g)).length;
  const gentle = show.genreIds.filter((g) => GENTLE.has(g)).length;
  const level = intense > gentle ? 2 : gentle > intense ? 0 : 1;
  let fit = [1, 0.45, 0][Math.abs(level - energy)];
  const minutes = facts?.episodeRuntime;
  if (minutes) {
    if (energy === 0) fit += minutes <= 35 ? 0.2 : minutes >= 55 ? -0.2 : 0;
    if (energy === 2) fit += minutes >= 40 ? 0.15 : minutes <= 25 ? -0.15 : 0;
  }
  return Math.max(0, Math.min(1, fit));
}

/**
 * The commitment tap. Mini-series: one short, finished season (or TMDb calls
 * it a miniseries). One season: season 1 is 13 episodes or fewer, whatever
 * comes after. Long-runner: three seasons or more.
 */
export function fitsCommitment(facts: SeriesFacts, time: Taps["time"]): boolean {
  // TMDb's "Miniseries" type isn't always one season (Special Ops has two), so check both.
  if (time === 0) return facts.seasons === 1 && !facts.ongoing && (facts.miniseries || facts.episodes <= 12);
  if (time === 1) return facts.firstSeasonEpisodes === null || facts.firstSeasonEpisodes <= 13;
  return facts.seasons >= 3;
}

/**
 * Hindi daily soaps sometimes escape TMDb's "Soap" genre (a 267-episode
 * Mahabharat came through as Drama/Family). No Hindi show you'd pick runs past
 * 100 episodes.
 */
export const HINDI_MAX_EPISODES = 100;

export function notADailySoap(facts: SeriesFacts, language: string): boolean {
  return language !== "hi" || facts.episodes <= HINDI_MAX_EPISODES;
}

/* ----------------------------------------------------------------- scoring */

export function seriesMainstreamPenalty(show: MovieCandidate): number {
  const rules = isSeriesLanguage(show.language) ? SERIES_LANGUAGES[show.language] : SERIES_LANGUAGES.en;
  const ratio = show.voteCount / rules.ubiquitous;
  if (ratio <= 1) return 0;
  return Math.min(0.3, 0.1 * Math.log2(ratio) + 0.06);
}

/** Same weights as films, with the series quality scale (TV rates higher: 6.5 → 0, 9 → 1). */
export function scoreSeries(
  show: MovieCandidate,
  taps: Taps & { mood: SeriesMood },
  taste: TasteProfile = NO_TASTE,
  facts?: SeriesFacts | null,
): number {
  const quality = Math.min(1, Math.max(0, (seriesRating(show) - 6.5) / 2.5));
  return (
    0.38 * quality +
    0.3 * seriesMoodFit(show, taps.mood) +
    0.14 * seriesEnergyFit(show, taps.energy, facts) +
    0.1 * ((tasteFit(show, taste) + 1) / 2) +
    0.08 * (show.onMyServices ? 1 : 0) -
    seriesMainstreamPenalty(show)
  );
}

export function seriesEligible(show: MovieCandidate, taps: Taps & { mood: SeriesMood }): boolean {
  if (!seriesGate(show).ok) return false;
  if (seriesMoodFit(show, taps.mood) === 0) return false;
  return seriesRating(show) >= SERIES_MOODS[taps.mood].minRating;
}
