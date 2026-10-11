import { describe, expect, it } from "vitest";
import {
  fitsCommitment,
  shortEnoughForHindi,
  seriesEnergyFit,
  seriesGate,
  seriesMoodFit,
  type SeriesFacts,
} from "@/lib/taste/series-rules";
import { airingLabel, cardMeta, startLine } from "@/lib/card-meta";
import { ruleBasedWhy } from "@/lib/picks/why";
import type { DeckCard } from "@/lib/deck/build-movies";
import type { MovieCandidate } from "@/lib/taste/types";

function show(over: Partial<MovieCandidate> = {}): MovieCandidate {
  return {
    id: 1,
    title: "Show",
    originalTitle: "Show",
    language: "en",
    year: 2019,
    releaseDate: "2019-01-01",
    genreIds: [80, 18],
    overview: "",
    posterPath: null,
    backdropPath: null,
    voteAverage: 8,
    voteCount: 1000,
    popularity: 10,
    onMyServices: false,
    ...over,
  };
}

const facts = (over: Partial<SeriesFacts> = {}): SeriesFacts => ({
  seasons: 3,
  episodes: 24,
  firstSeasonEpisodes: 8,
  episodeRuntime: 45,
  ongoing: false,
  miniseries: false,
  ...over,
});

describe("series gate", () => {
  it("lets English through on quality and Hindi of any genre when it's well rated", () => {
    expect(seriesGate(show()).ok).toBe(true);
    // A Hindi comedy-drama (Panchayat-like) is in: any genre, well rated.
    expect(seriesGate(show({ language: "hi", genreIds: [35, 18], voteAverage: 8.2, voteCount: 150 }))).toEqual({
      ok: true,
      reason: "acclaimed",
    });
    expect(seriesGate(show({ language: "hi", voteAverage: 6.5, voteCount: 150 })).ok).toBe(false);
  });

  it("never lets in animation, soaps, kids' shows or other languages", () => {
    expect(seriesGate(show({ genreIds: [16, 80] })).ok).toBe(false);
    expect(seriesGate(show({ genreIds: [10766, 18] })).ok).toBe(false);
    expect(seriesGate(show({ genreIds: [10762, 35] })).ok).toBe(false);
    expect(seriesGate(show({ language: "ko" })).ok).toBe(false);
  });

  it("keeps Hindi to short series: Mirzapur-style yes, long runs and soap formats no", () => {
    expect(shortEnoughForHindi(facts({ seasons: 3, episodes: 30 }), "hi")).toBe(true); // Mirzapur
    expect(shortEnoughForHindi(facts({ seasons: 5, episodes: 32 }), "hi")).toBe(true); // Panchayat
    expect(shortEnoughForHindi(facts({ seasons: 1, episodes: 9 }), "hi")).toBe(true);
    expect(shortEnoughForHindi(facts({ seasons: 28, episodes: 267 }), "hi")).toBe(false); // a daily soap
    expect(shortEnoughForHindi(facts({ seasons: 4, episodes: 52 }), "hi")).toBe(false); // past 50 episodes
    expect(shortEnoughForHindi(facts({ seasons: 6, episodes: 36 }), "hi")).toBe(false); // too many seasons
    expect(shortEnoughForHindi(facts({ seasons: 2, episodes: 40 }), "hi")).toBe(false); // 20-episode seasons
    // English isn't held to this.
    expect(shortEnoughForHindi(facts({ seasons: 18, episodes: 187 }), "en")).toBe(true);
  });
});

describe("series moods", () => {
  it("keeps feel-good warm: a pure sitcom isn't feel-good, a comedy-drama is", () => {
    expect(seriesMoodFit(show({ genreIds: [35] }), "feelgood")).toBe(0);
    expect(seriesMoodFit(show({ genreIds: [35, 18] }), "feelgood")).toBeGreaterThan(0);
    expect(seriesMoodFit(show({ genreIds: [35] }), "funny")).toBeGreaterThan(0);
  });

  it("keeps dark apart from gripping: action-adventure is gripping, not dark", () => {
    expect(seriesMoodFit(show({ genreIds: [10759, 18] }), "gripping")).toBeGreaterThan(0);
    expect(seriesMoodFit(show({ genreIds: [10759, 18] }), "dark")).toBe(0);
    expect(seriesMoodFit(show({ genreIds: [80, 18] }), "dark")).toBeGreaterThan(0);
  });

  it("nudges energy by episode length", () => {
    const sitcom = show({ genreIds: [35] });
    expect(seriesEnergyFit(sitcom, 0, facts({ episodeRuntime: 25 }))).toBeGreaterThan(
      seriesEnergyFit(sitcom, 0, facts({ episodeRuntime: 60 })),
    );
  });
});

describe("commitment", () => {
  it("mini-series: one finished season", () => {
    expect(fitsCommitment(facts({ seasons: 1, episodes: 8, miniseries: true }), 0)).toBe(true);
    expect(fitsCommitment(facts({ seasons: 1, episodes: 6 }), 0)).toBe(true);
    // TMDb calls Special Ops a miniseries, but it has two seasons.
    expect(fitsCommitment(facts({ seasons: 2, miniseries: true }), 0)).toBe(false);
    // One season so far, more coming: not a mini-series.
    expect(fitsCommitment(facts({ seasons: 1, episodes: 10, ongoing: true }), 0)).toBe(false);
  });

  it("one season: a first season you can get through", () => {
    expect(fitsCommitment(facts({ firstSeasonEpisodes: 10 }), 1)).toBe(true);
    expect(fitsCommitment(facts({ firstSeasonEpisodes: 22 }), 1)).toBe(false);
  });

  it("long-runner: three seasons or more", () => {
    expect(fitsCommitment(facts({ seasons: 3 }), 2)).toBe(true);
    expect(fitsCommitment(facts({ seasons: 2 }), 2)).toBe(false);
  });
});

describe("series cards and reasons", () => {
  const card = {
    media: "series",
    id: 1,
    title: "Paatal Lok",
    originalTitle: "Paatal Lok",
    year: 2020,
    language: "hi",
    languageLabel: "Hindi",
    overview: "",
    posterPath: null,
    backdropPath: null,
    rating: 7.5,
    votes: 121,
    genreIds: [80, 18],
    genres: ["Crime", "Drama"],
    runtime: 45,
    directors: ["Sudip Sharma"],
    cast: [],
    streamingOn: ["Prime Video"],
    gate: "acclaimed",
    trailerKey: null,
    series: facts({ seasons: 2, episodes: 17, firstSeasonEpisodes: 9, ongoing: true }),
    book: null,
  } satisfies DeckCard;

  it("shows seasons, episode length and whether it's still airing", () => {
    expect(cardMeta(card)).toBe("2020 · Hindi · 2 seasons · 45-min episodes");
    expect(airingLabel(card)).toBe("Still airing · 2 seasons so far");
    expect(startLine(card)).toBe("9 episodes · about 45 min each · 2 seasons so far, still airing");
  });

  it("explains a series pick in series terms", () => {
    const why = ruleBasedWhy({
      ...card,
      mood: "gripping",
      energy: 2,
      beat: 2,
      seasons: 2,
      firstSeasonEpisodes: 9,
    });
    expect(why).toContain("best-rated Hindi shows");
    expect(why).toContain("season 1 is 9 episodes of about 45 min");
  });
});
