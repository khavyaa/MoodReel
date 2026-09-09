import type { MovieCard, MovieState } from "@/lib/types";

export type SeenFilterOptions = {
  /** Keep watchlisted movies in the deck (used by "replay my watchlist"). */
  includeWatchlisted?: boolean;
  /** Extra ids to drop, e.g. a guest's locally stored history. */
  excludeIds?: Iterable<number>;
};

/**
 * Remove anything the user has already dealt with. This runs before ranking so
 * the deck is never padded out with movies the user has explicitly dismissed.
 */
export function filterSeen(
  movies: MovieCard[],
  states: Map<number, MovieState> | Record<number, MovieState>,
  options: SeenFilterOptions = {},
): MovieCard[] {
  const stateMap =
    states instanceof Map
      ? states
      : new Map(Object.entries(states).map(([k, v]) => [Number(k), v]));
  const extra = new Set(options.excludeIds ?? []);

  return movies.filter((movie) => {
    if (extra.has(movie.id)) return false;
    const state = stateMap.get(movie.id);
    if (!state) return true;
    if (state.watched || state.skipped || state.disliked) return false;
    if (state.watchlisted && !options.includeWatchlisted) return false;
    return true;
  });
}

export function statesToMap(states: MovieState[]): Map<number, MovieState> {
  return new Map(states.map((s) => [s.tmdbMovieId, s]));
}
