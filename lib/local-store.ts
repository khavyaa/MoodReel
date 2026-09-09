"use client";

import {
  applyAction,
  emptyMovieState,
  type LanguageCode,
  type MovieActionType,
  type MovieCard,
  type MovieState,
} from "@/lib/types";

const STATES_KEY = "moodreel.states.v1";
const MOVIES_KEY = "moodreel.movies.v1";
const PREFS_KEY = "moodreel.prefs.v1";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private browsing or a full quota: guest history is best-effort.
  }
}

/* ------------------------------------------------------------ guest states */

export function readLocalStates(): Record<number, MovieState> {
  return read<Record<number, MovieState>>(STATES_KEY, {});
}

export function writeLocalState(state: MovieState) {
  const all = readLocalStates();
  all[state.tmdbMovieId] = state;
  write(STATES_KEY, all);
}

export function applyLocalAction(
  tmdbMovieId: number,
  action: MovieActionType,
  userRating?: number | null,
): MovieState {
  const all = readLocalStates();
  const next = applyAction(all[tmdbMovieId] ?? emptyMovieState(tmdbMovieId), action);
  if (userRating !== undefined && userRating !== null) next.userRating = userRating;
  all[tmdbMovieId] = next;
  write(STATES_KEY, all);
  return next;
}

export function clearLocalHistory() {
  write(STATES_KEY, {});
  write(MOVIES_KEY, {});
}

/* ------------------------------------ cached cards so guest lists can render */

export function rememberMovie(movie: MovieCard) {
  const all = read<Record<number, MovieCard>>(MOVIES_KEY, {});
  all[movie.id] = movie;
  write(MOVIES_KEY, all);
}

export function readRememberedMovies(): Record<number, MovieCard> {
  return read<Record<number, MovieCard>>(MOVIES_KEY, {});
}

/* ------------------------------------------------------------- preferences */

export type Preferences = {
  languages: LanguageCode[];
  lastMood: string | null;
};

export const DEFAULT_PREFERENCES: Preferences = {
  languages: ["en", "hi", "ta"],
  lastMood: null,
};

export function readPreferences(): Preferences {
  const prefs = read<Partial<Preferences>>(PREFS_KEY, {});
  const languages = (prefs.languages ?? DEFAULT_PREFERENCES.languages).filter(
    (l): l is LanguageCode => l === "en" || l === "hi" || l === "ta",
  );
  return {
    languages: languages.length ? languages : DEFAULT_PREFERENCES.languages,
    lastMood: prefs.lastMood ?? null,
  };
}

export function writePreferences(prefs: Partial<Preferences>) {
  write(PREFS_KEY, { ...readPreferences(), ...prefs });
}
