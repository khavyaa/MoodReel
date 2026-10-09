import { describe, expect, it } from "vitest";
import { DECK_SIZE, composeDeck, type Scored } from "@/lib/deck/compose";
import { MAX_SAVES, choose, deckIsDone, startFinale } from "@/lib/deck/finale";
import type { MovieCandidate } from "@/lib/taste/types";

function scored(id: number, language: string, score: number): Scored {
  return {
    score,
    movie: {
      id,
      title: `Film ${id}`,
      originalTitle: `Film ${id}`,
      language,
      year: 2020,
      releaseDate: null,
      genreIds: [],
      overview: "",
      posterPath: null,
      backdropPath: null,
      voteAverage: 7,
      voteCount: 1000,
      popularity: 1,
      onMyServices: false,
    } satisfies MovieCandidate,
  };
}

const pool = (lang: string, n: number, start: number) =>
  Array.from({ length: n }, (_, i) => scored(start + i, lang, 1 - i / 100));

describe("composeDeck", () => {
  it("deals a full deck that's about two-thirds English", () => {
    const deck = composeDeck([...pool("en", 30, 1), ...pool("ta", 10, 100), ...pool("ml", 10, 200)]);
    expect(deck).toHaveLength(DECK_SIZE);
    expect(deck.filter((m) => m.language === "en")).toHaveLength(10);
  });

  it("spreads the other languages through the deck instead of bunching them", () => {
    const deck = composeDeck([...pool("en", 30, 1), ...pool("hi", 10, 100)]);
    const positions = deck.map((m, i) => (m.language === "hi" ? i : -1)).filter((i) => i >= 0);
    const gaps = positions.slice(1).map((p, i) => p - positions[i]);
    expect(Math.max(...gaps)).toBeLessThanOrEqual(4);
    expect(positions[0]).toBeLessThan(4);
  });

  it("tops up with English when few Indian films pass your rules, and vice versa", () => {
    expect(composeDeck([...pool("en", 30, 1), ...pool("ml", 2, 100)])).toHaveLength(DECK_SIZE);
    const mostlyTamil = composeDeck([...pool("en", 3, 1), ...pool("ta", 30, 100)]);
    expect(mostlyTamil).toHaveLength(DECK_SIZE);
    expect(mostlyTamil.filter((m) => m.language === "en")).toHaveLength(3);
  });

  it("deals what exists when there isn't a full deck", () => {
    expect(composeDeck(pool("en", 4, 1))).toHaveLength(4);
    expect(composeDeck([])).toEqual([]);
  });

  it("never repeats a film and varies a little between deals", () => {
    const input = [...pool("en", 40, 1), ...pool("ta", 20, 100)];
    const a = composeDeck(input, { seed: 1 });
    expect(new Set(a.map((m) => m.id)).size).toBe(a.length);
    const b = composeDeck(input, { seed: 2 });
    expect(a.map((m) => m.id)).not.toEqual(b.map((m) => m.id));
  });
});

describe("head-to-head", () => {
  it("needs at least two saves", () => {
    expect(startFinale([])).toBeNull();
    expect(startFinale(["only"])).toBeNull();
  });

  it("runs one round per challenger and keeps the winner on", () => {
    let step = { done: false as const, finale: startFinale(["A", "B", "C", "D"])! };
    expect(step.finale.rounds).toBe(3);
    const picks = ["challenger", "champion", "challenger"] as const; // B beats A, B holds vs C, D beats B
    let result;
    for (const side of picks) {
      result = choose(step.finale, side);
      if (!result.done) step = result;
    }
    expect(result).toEqual({ done: true, winner: "D" });
  });

  it("ends the deck at four saves or when the cards run out", () => {
    expect(deckIsDone(3, 15, MAX_SAVES)).toBe(true);
    expect(deckIsDone(15, 15, 1)).toBe(true);
    expect(deckIsDone(5, 15, 2)).toBe(false);
  });
});

describe("pool queries and animation cap", () => {
  it("queries mind-bending English films by keyword and Indian films by genre", async () => {
    const { poolQueries } = await import("@/lib/deck/build-movies");
    const taps = { mood: "mind", energy: 2, time: 2 } as const;
    expect(poolQueries("en", taps).every((q) => q.keywords?.length)).toBe(true);
    expect(poolQueries("ta", taps).every((q) => !q.keywords)).toBe(true);
  });

  it("includes a 'well rated, fewer votes' pool for English", async () => {
    const { poolQueries } = await import("@/lib/deck/build-movies");
    expect(poolQueries("en", { mood: "gripping", energy: 1, time: 1 }).some((q) => q.maxVotes)).toBe(true);
  });

  it("keeps only the two best animated films", async () => {
    const { capAnimated } = await import("@/lib/deck/build-movies");
    const s = (id: number, animated: boolean, score: number) => ({
      score,
      movie: { ...scored(id, "en", score).movie, genreIds: animated ? [16, 35] : [35] },
    });
    const kept = capAnimated([s(1, true, 0.9), s(2, true, 0.8), s(3, true, 0.7), s(4, false, 0.1)]);
    expect(kept.map((k) => k.movie.id).sort()).toEqual([1, 2, 4]);
  });
});

describe("pool query parameters", () => {
  it("never asks TMDb for stand-up or concert specials", async () => {
    const { discoverParams } = await import("@/lib/tmdb/movies");
    const params = discoverParams({
      language: "en", genres: [35], excludeGenres: [], minVotes: 300, runtimeMax: 100,
      onlyMyServices: true, sortBy: "vote_average.desc", page: 1,
    });
    expect(params.without_keywords).toContain("9716");
    expect(params.with_watch_providers).toBe("8|119|350|2336");
    expect(params["with_runtime.lte"]).toBe(100);
  });

  it("keeps Indian mind-bending picks to twisty genres", async () => {
    const { poolQueries } = await import("@/lib/deck/build-movies");
    const genres = poolQueries("ml", { mood: "mind", energy: 1, time: 2 })[0].genres;
    expect(genres).not.toContain(18); // drama
  });
});
