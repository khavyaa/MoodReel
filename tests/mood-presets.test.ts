import { describe, expect, it } from "vitest";
import {
  MOOD_IDS,
  MOOD_LIST,
  MOOD_PRESETS,
  isMoodId,
} from "@/lib/recommendations/mood-presets";
import { buildDiscoverParams } from "@/lib/tmdb";

describe("mood presets", () => {
  it("exposes one preset per mood id, keyed consistently", () => {
    expect(MOOD_LIST).toHaveLength(MOOD_IDS.length);
    for (const id of MOOD_IDS) {
      expect(MOOD_PRESETS[id].id).toBe(id);
      expect(MOOD_PRESETS[id].label.length).toBeGreaterThan(0);
    }
  });

  it("validates mood ids", () => {
    expect(isMoodId("edgeOfSeat")).toBe(true);
    expect(isMoodId("nope")).toBe(false);
    expect(isMoodId(undefined)).toBe(false);
  });

  it("never lists a genre as both included and excluded", () => {
    for (const preset of MOOD_LIST) {
      const overlap = preset.genres.filter((g) => preset.excludeGenres?.includes(g));
      expect(overlap, `${preset.id} has contradictory genres`).toEqual([]);
    }
  });
});

describe("buildDiscoverParams", () => {
  it("restricts discovery to the requested original language", () => {
    const params = buildDiscoverParams({
      language: "ta",
      preset: MOOD_PRESETS.lightAndFunny,
      page: 2,
    });
    expect(params.with_original_language).toBe("ta");
    expect(params.page).toBe(2);
    expect(params.include_adult).toBe("false");
  });

  it("ORs included genres and ANDs excluded ones", () => {
    const params = buildDiscoverParams({
      language: "en",
      preset: MOOD_PRESETS.darkAndIntense,
      page: 1,
    });
    expect(params.with_genres).toBe("18|53|80");
    expect(params.without_genres).toBe("35,10751,16");
  });

  it("always sets a vote-count floor so rating sorts do not return junk", () => {
    for (const preset of MOOD_LIST) {
      const params = buildDiscoverParams({ language: "en", preset, page: 1 });
      expect(Number(params["vote_count.gte"])).toBeGreaterThan(0);
    }
  });

  it("passes date bounds through for the classics preset", () => {
    const params = buildDiscoverParams({
      language: "en",
      preset: MOOD_PRESETS.classicRewatch,
      page: 1,
    });
    expect(params["primary_release_date.lte"]).toBe("2010-12-31");
    expect(params.with_genres).toBeUndefined();
  });
});
