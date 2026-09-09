import { describe, expect, it } from "vitest";
import {
  MOOD_IDS,
  MOOD_LIST,
  MOOD_PRESETS,
  isMoodId,
} from "@/lib/recommendations/mood-presets";
import { buildDiscoverParams, scaledVoteFloor } from "@/lib/tmdb";

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

  it("scales the vote floor down for Hindi and Tamil", () => {
    // TMDb vote counts skew heavily English; a flat floor would exclude entire
    // catalogues. At the classics floor of 300, Tamil has literally zero titles.
    const floors = (["en", "hi", "ta"] as const).map((language) =>
      Number(
        buildDiscoverParams({ language, preset: MOOD_PRESETS.classicRewatch, page: 1 })[
          "vote_count.gte"
        ],
      ),
    );
    const [en, hi, ta] = floors;
    expect(en).toBe(300);
    expect(hi).toBeLessThan(en);
    expect(ta).toBeLessThan(hi);
  });

  it("never drops the vote floor into unreviewed noise", () => {
    for (const preset of MOOD_LIST) {
      for (const language of ["en", "hi", "ta"] as const) {
        expect(scaledVoteFloor(language, preset.minVoteCount)).toBeGreaterThanOrEqual(20);
      }
    }
  });

  it("leaves English floors unscaled", () => {
    for (const preset of MOOD_LIST) {
      expect(scaledVoteFloor("en", preset.minVoteCount)).toBe(
        Math.max(20, preset.minVoteCount ?? 25),
      );
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
