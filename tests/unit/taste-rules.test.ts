import { describe, expect, it } from "vitest";
import {
  GENRE,
  eligible,
  energyFit,
  mainstreamPenalty,
  moodFit,
  passesGate,
  scoreMovie,
  weightedRating,
} from "@/lib/taste/rules";
import { buildTasteProfile } from "@/lib/taste/profile";
import type { MovieCandidate, Taps } from "@/lib/taste/types";

function film(o: Partial<MovieCandidate> & { id: number }): MovieCandidate {
  return {
    title: `Film ${o.id}`,
    originalTitle: `Film ${o.id}`,
    language: "en",
    year: 2018,
    releaseDate: "2018-01-01",
    genreIds: [GENRE.thriller],
    overview: "",
    posterPath: null,
    backdropPath: null,
    voteAverage: 7.5,
    voteCount: 5000,
    popularity: 20,
    onMyServices: false,
    ...o,
  };
}

const TAPS: Taps = { mood: "gripping", energy: 2, time: 1 };

describe("weighted rating", () => {
  it("stops a fresh release with few votes outranking an established classic", () => {
    // Real TMDb numbers from the Oct 2026 probe.
    const fresh = weightedRating(9.1, 437, "en"); // a new animated release
    const classic = weightedRating(8.7, 31526, "en"); // The Shawshank Redemption
    expect(classic).toBeGreaterThan(fresh);
  });

  it("uses each language's own prior, so Malayalam films aren't sunk by low vote counts", () => {
    // Kumbalangi Nights: 8.1 from 130 votes.
    expect(weightedRating(8.1, 130, "ml")).toBeGreaterThan(7.5);
    // The same numbers judged as an English film are pulled much closer to average.
    expect(weightedRating(8.1, 130, "en")).toBeLessThan(6.8);
  });
});

describe("fresh releases", () => {
  it("trusts a brand-new film's early votes less than the same votes six months on", () => {
    expect(weightedRating(8.6, 4500, "en", 30)).toBeLessThan(weightedRating(8.6, 4500, "en", 400));
  });
});

describe("language gate", () => {
  it("lets English films through on quality alone, whatever the genre", () => {
    expect(passesGate(film({ id: 1, genreIds: [GENRE.romance] })).ok).toBe(true);
  });

  it("lets Tamil, Malayalam and Hindi crime, thriller and mystery through", () => {
    for (const language of ["ta", "ml", "hi"]) {
      for (const g of [GENRE.crime, GENRE.thriller, GENRE.mystery]) {
        const r = passesGate(film({ id: 2, language, genreIds: [GENRE.drama, g], voteAverage: 6.4, voteCount: 200 }));
        expect(r, `${language}/${g}`).toEqual({ ok: true, reason: "crime/thriller" });
      }
    }
  });

  it("lets other Indian films through only when the storyline is acclaimed", () => {
    const acclaimed = film({ id: 3, language: "ml", genreIds: [GENRE.drama, GENRE.comedy], voteAverage: 8.1, voteCount: 130 });
    const ordinary = film({ id: 4, language: "ml", genreIds: [GENRE.drama, GENRE.comedy], voteAverage: 6.8, voteCount: 130 });
    expect(passesGate(acclaimed)).toEqual({ ok: true, reason: "acclaimed" });
    expect(passesGate(ordinary).ok).toBe(false);
  });

  it("does not call a high average from a handful of votes acclaimed", () => {
    // A stand-up special at 8.3 from 22 votes, from the probe.
    expect(passesGate(film({ id: 5, language: "hi", genreIds: [GENRE.comedy], voteAverage: 8.3, voteCount: 22 })).ok).toBe(false);
  });

  it("keeps out languages you didn't ask for and films below the vote floor", () => {
    expect(passesGate(film({ id: 6, language: "ko" })).ok).toBe(false);
    expect(passesGate(film({ id: 7, language: "en", voteCount: 120 })).ok).toBe(false);
    expect(passesGate(film({ id: 8, language: "ml", genreIds: [GENRE.thriller], voteCount: 19 })).ok).toBe(false);
  });
});

describe("moods", () => {
  it("doesn't count a plain drama as dark, so dark and moving decks differ", () => {
    expect(moodFit(film({ id: 30, genreIds: [GENRE.drama] }), "dark")).toBe(0);
    expect(moodFit(film({ id: 31, genreIds: [GENRE.drama, GENRE.crime] }), "dark")).toBeGreaterThan(0);
    expect(moodFit(film({ id: 32, genreIds: [GENRE.drama, GENRE.crime] }), "moving")).toBe(0);
  });

  it("keeps family comedies out of funny", () => {
    expect(moodFit(film({ id: 33, genreIds: [GENRE.comedy, GENRE.family, GENRE.animation] }), "funny")).toBe(0);
  });

  it("rules out films with a genre the mood excludes", () => {
    expect(moodFit(film({ id: 9, genreIds: [GENRE.thriller, GENRE.family] }), "gripping")).toBe(0);
    expect(moodFit(film({ id: 10, genreIds: [GENRE.drama, GENRE.romance] }), "dark")).toBe(0);
    expect(moodFit(film({ id: 11, genreIds: [GENRE.comedy, GENRE.horror] }), "funny")).toBe(0);
  });

  it("fits better the more of a film's genres the mood wants", () => {
    const all = moodFit(film({ id: 12, genreIds: [GENRE.thriller, GENRE.crime] }), "gripping");
    const some = moodFit(film({ id: 13, genreIds: [GENRE.thriller, GENRE.drama, GENRE.history] }), "gripping");
    expect(all).toBeGreaterThan(some);
    expect(some).toBeGreaterThan(0);
  });

  it("asks more of a film for the moving mood than for funny", () => {
    const decentDrama = film({ id: 14, genreIds: [GENRE.drama], voteAverage: 7.0, voteCount: 8000 });
    expect(eligible(decentDrama, { mood: "moving", energy: 0, time: 2 })).toBe(false);
    const decentComedy = film({ id: 15, genreIds: [GENRE.comedy], voteAverage: 7.0, voteCount: 8000 });
    expect(eligible(decentComedy, { mood: "funny", energy: 0, time: 2 })).toBe(true);
  });
});

describe("energy", () => {
  it("matches intense films to 'lean in' and gentle ones to 'lean back'", () => {
    const intense = film({ id: 16, genreIds: [GENRE.thriller, GENRE.action] });
    const gentle = film({ id: 17, genreIds: [GENRE.comedy, GENRE.romance] });
    expect(energyFit(intense, 2)).toBe(1);
    expect(energyFit(intense, 0)).toBe(0);
    expect(energyFit(gentle, 0)).toBe(1);
  });
});

describe("scoring", () => {
  it("marks down films everyone has seen, without excluding them", () => {
    const famous = film({ id: 18, voteCount: 14000 }); // Godfather Part II territory on TMDb
    const known = film({ id: 19, voteCount: 2500 });
    expect(mainstreamPenalty(known)).toBe(0);
    expect(mainstreamPenalty(famous)).toBeGreaterThan(0);
    expect(mainstreamPenalty(film({ id: 20, voteCount: 10_000_000 }))).toBeLessThanOrEqual(0.3);
    expect(scoreMovie(known, TAPS)).toBeGreaterThan(scoreMovie(famous, TAPS));
  });

  it("prefers what you can stream, all else equal", () => {
    expect(scoreMovie(film({ id: 21, onMyServices: true }), TAPS)).toBeGreaterThan(
      scoreMovie(film({ id: 21, onMyServices: false }), TAPS),
    );
  });

  it("has no raw popularity term", () => {
    expect(scoreMovie(film({ id: 22, popularity: 900 }), TAPS)).toBe(scoreMovie(film({ id: 22, popularity: 1 }), TAPS));
  });

  it("learns from saves and dislikes", () => {
    const thriller = film({ id: 23, genreIds: [GENRE.thriller] });
    const likes = buildTasteProfile([{ action: "saved", tags: [String(GENRE.thriller)] }]);
    const dislikes = buildTasteProfile([{ action: "disliked", tags: [String(GENRE.thriller)] }]);
    expect(scoreMovie(thriller, TAPS, likes)).toBeGreaterThan(scoreMovie(thriller, TAPS, dislikes));
  });

  it("keeps taste bounded however long the history", () => {
    const many = Array.from({ length: 500 }, () => ({ action: "saved" as const, tags: ["35"] }));
    expect(buildTasteProfile(many).tags["35"]).toBeLessThanOrEqual(1);
  });
});
