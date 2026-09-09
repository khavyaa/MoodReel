import { describe, expect, it } from "vitest";
import {
  buildTasteProfile,
  dedupeMovies,
  interleaveByLanguage,
  rankMovies,
  scoreMovie,
  EMPTY_TASTE,
} from "@/lib/recommendations/rank-movies";
import { MOOD_PRESETS } from "@/lib/recommendations/mood-presets";
import type { MovieCard } from "@/lib/types";

function movie(overrides: Partial<MovieCard> & { id: number }): MovieCard {
  return {
    title: `Movie ${overrides.id}`,
    originalTitle: `Movie ${overrides.id}`,
    year: 2020,
    overview: "",
    posterPath: null,
    backdropPath: null,
    language: "en",
    genreIds: [],
    genres: [],
    voteAverage: 6,
    voteCount: 100,
    popularity: 50,
    ...overrides,
  };
}

describe("scoreMovie", () => {
  const preset = MOOD_PRESETS.lightAndFunny; // genre 35

  it("scores an on-mood movie above an off-mood one", () => {
    const onMood = movie({ id: 1, genreIds: [35] });
    const offMood = movie({ id: 2, genreIds: [27] });
    expect(scoreMovie(onMood, preset, EMPTY_TASTE, 1)).toBeGreaterThan(
      scoreMovie(offMood, preset, EMPTY_TASTE, 1),
    );
  });

  it("stays within 0..1 across extreme inputs", () => {
    const extreme = movie({ id: 3, popularity: 99999, voteAverage: 10, genreIds: [35] });
    const bare = movie({ id: 4, popularity: 0, voteAverage: 0, genreIds: [] });
    for (const candidate of [extreme, bare]) {
      const score = scoreMovie(candidate, preset, EMPTY_TASTE, 7);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });

  it("lifts movies matching learned taste", () => {
    const taste = buildTasteProfile([
      { action: "liked", genreIds: [35], language: "ta" },
      { action: "liked", genreIds: [35], language: "ta" },
      { action: "liked", genreIds: [35], language: "ta" },
    ]);
    const target = movie({ id: 5, genreIds: [35], language: "ta" });
    expect(scoreMovie(target, preset, taste, 1)).toBeGreaterThan(
      scoreMovie(target, preset, EMPTY_TASTE, 1),
    );
  });

  it("demotes popular titles under the hidden-gems preset", () => {
    const blockbuster = movie({ id: 6, popularity: 900, voteAverage: 8 });
    const gem = movie({ id: 7, popularity: 12, voteAverage: 8 });
    const gems = MOOD_PRESETS.hiddenGems;
    expect(scoreMovie(gem, gems, EMPTY_TASTE, 1)).toBeGreaterThan(
      scoreMovie(blockbuster, gems, EMPTY_TASTE, 1),
    );
  });

  it("is deterministic for a given seed", () => {
    const target = movie({ id: 8, genreIds: [35] });
    expect(scoreMovie(target, preset, EMPTY_TASTE, 42)).toBe(
      scoreMovie(target, preset, EMPTY_TASTE, 42),
    );
  });
});

describe("buildTasteProfile", () => {
  it("moves affinity in opposite directions for likes and dislikes", () => {
    const taste = buildTasteProfile([
      { action: "liked", genreIds: [35], language: "en" },
      { action: "disliked", genreIds: [27], language: "en" },
    ]);
    expect(taste.genreWeights[35]).toBeGreaterThan(0);
    expect(taste.genreWeights[27]).toBeLessThan(0);
  });

  it("keeps weights bounded no matter how long the history is", () => {
    const signals = Array.from({ length: 500 }, () => ({
      action: "liked" as const,
      genreIds: [18],
      language: "hi",
    }));
    const taste = buildTasteProfile(signals);
    expect(taste.genreWeights[18]).toBeLessThanOrEqual(1);
    expect(taste.languageWeights.hi).toBeLessThanOrEqual(1);
  });
});

describe("deck assembly", () => {
  it("dedupes repeated tmdb ids, keeping the first", () => {
    const deduped = dedupeMovies([movie({ id: 1 }), movie({ id: 2 }), movie({ id: 1 })]);
    expect(deduped.map((m) => m.id)).toEqual([1, 2]);
  });

  it("ranks highest scores first", () => {
    const ranked = rankMovies(
      [movie({ id: 1, genreIds: [] }), movie({ id: 2, genreIds: [35], popularity: 400 })],
      MOOD_PRESETS.lightAndFunny,
    );
    expect(ranked[0].id).toBe(2);
    expect(ranked[0].score).toBeGreaterThanOrEqual(ranked[1].score);
  });

  it("alternates languages instead of front-loading one", () => {
    const ranked = rankMovies(
      [
        movie({ id: 1, language: "en" }),
        movie({ id: 2, language: "en" }),
        movie({ id: 3, language: "hi" }),
        movie({ id: 4, language: "ta" }),
      ],
      MOOD_PRESETS.lightAndFunny,
    );
    const languages = interleaveByLanguage(ranked).map((m) => m.language);
    expect(new Set(languages.slice(0, 3)).size).toBe(3);
    expect(languages).toHaveLength(4);
  });
});
