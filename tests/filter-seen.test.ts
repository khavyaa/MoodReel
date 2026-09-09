import { describe, expect, it } from "vitest";
import { filterSeen, statesToMap } from "@/lib/recommendations/filter-seen";
import { applyAction, emptyMovieState, type MovieCard, type MovieState } from "@/lib/types";

function card(id: number): MovieCard {
  return {
    id,
    title: `Movie ${id}`,
    originalTitle: `Movie ${id}`,
    year: 2020,
    overview: "",
    posterPath: null,
    backdropPath: null,
    language: "en",
    genreIds: [],
    genres: [],
    voteAverage: 6,
    voteCount: 10,
    popularity: 10,
  };
}

function state(id: number, patch: Partial<MovieState>): MovieState {
  return { ...emptyMovieState(id), ...patch };
}

describe("filterSeen", () => {
  const movies = [card(1), card(2), card(3), card(4), card(5)];

  it("drops watched, skipped, disliked and watchlisted movies", () => {
    const states = statesToMap([
      state(1, { watched: true }),
      state(2, { skipped: true }),
      state(3, { disliked: true }),
      state(4, { watchlisted: true }),
    ]);
    expect(filterSeen(movies, states).map((m) => m.id)).toEqual([5]);
  });

  it("keeps watchlisted movies when asked to", () => {
    const states = statesToMap([state(4, { watchlisted: true })]);
    const kept = filterSeen(movies, states, { includeWatchlisted: true });
    expect(kept.map((m) => m.id)).toContain(4);
  });

  it("also honours ids passed in directly, for guests", () => {
    expect(filterSeen(movies, new Map(), { excludeIds: [1, 2] }).map((m) => m.id)).toEqual([
      3, 4, 5,
    ]);
  });

  it("accepts a plain object of states", () => {
    const kept = filterSeen(movies, { 5: state(5, { watched: true }) });
    expect(kept.map((m) => m.id)).toEqual([1, 2, 3, 4]);
  });

  it("returns everything when the user has no history", () => {
    expect(filterSeen(movies, new Map())).toHaveLength(movies.length);
  });
});

describe("applyAction", () => {
  it("treats a right swipe as like plus watchlist", () => {
    const next = applyAction(emptyMovieState(1), "liked");
    expect(next.liked).toBe(true);
    expect(next.watchlisted).toBe(true);
  });

  it("clears the watchlist when a movie is marked watched", () => {
    const next = applyAction(applyAction(emptyMovieState(1), "liked"), "watched");
    expect(next.watched).toBe(true);
    expect(next.watchlisted).toBe(false);
  });

  it("makes like and dislike mutually exclusive", () => {
    const next = applyAction(applyAction(emptyMovieState(1), "liked"), "disliked");
    expect(next.disliked).toBe(true);
    expect(next.liked).toBe(false);
    expect(next.watchlisted).toBe(false);
  });

  it("removes from the watchlist without marking the movie seen", () => {
    const next = applyAction(applyAction(emptyMovieState(1), "liked"), "removed_from_watchlist");
    expect(next.watchlisted).toBe(false);
    expect(next.watched).toBe(false);
  });
});
