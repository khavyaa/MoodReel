export type LanguageCode = "en" | "hi" | "ta";

export const LANGUAGES: { code: LanguageCode; label: string; native: string }[] = [
  { code: "en", label: "English", native: "English" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
  { code: "ta", label: "Tamil", native: "தமிழ்" },
];

export const LANGUAGE_CODES = LANGUAGES.map((l) => l.code) as LanguageCode[];

export type MovieActionType =
  | "liked"
  | "disliked"
  | "skipped"
  | "watchlisted"
  | "watched"
  | "removed_from_watchlist";

export const MOVIE_ACTION_TYPES: MovieActionType[] = [
  "liked",
  "disliked",
  "skipped",
  "watchlisted",
  "watched",
  "removed_from_watchlist",
];

/** A movie shaped for the swipe deck and list grids. */
export type MovieCard = {
  id: number;
  title: string;
  originalTitle: string;
  year: number | null;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  language: string;
  genreIds: number[];
  genres: string[];
  voteAverage: number;
  voteCount: number;
  popularity: number;
  runtime?: number | null;
};

export type MovieState = {
  tmdbMovieId: number;
  liked: boolean;
  disliked: boolean;
  skipped: boolean;
  watchlisted: boolean;
  watched: boolean;
  userRating: number | null;
  updatedAt: string;
};

export type Profile = {
  id: string;
  displayName: string | null;
  preferredLanguages: LanguageCode[];
  onboardingCompleted: boolean;
};

export type CastMember = { id: number; name: string; character: string; profilePath: string | null };

export type MovieDetails = MovieCard & {
  runtime: number | null;
  tagline: string | null;
  status: string;
  releaseDate: string | null;
  cast: CastMember[];
  directors: string[];
  trailerKey: string | null;
  similar: MovieCard[];
  providers: { name: string; logoPath: string | null }[];
  providerLink: string | null;
};

export function emptyMovieState(tmdbMovieId: number): MovieState {
  return {
    tmdbMovieId,
    liked: false,
    disliked: false,
    skipped: false,
    watchlisted: false,
    watched: false,
    userRating: null,
    updatedAt: new Date().toISOString(),
  };
}

/** Fold one action into a movie state. Pure so it can run on the client and the server. */
export function applyAction(state: MovieState, action: MovieActionType): MovieState {
  const next: MovieState = { ...state, updatedAt: new Date().toISOString() };
  switch (action) {
    case "liked":
      next.liked = true;
      next.disliked = false;
      next.watchlisted = true;
      next.skipped = false;
      break;
    case "disliked":
      next.disliked = true;
      next.liked = false;
      next.watchlisted = false;
      break;
    case "skipped":
      next.skipped = true;
      break;
    case "watchlisted":
      next.watchlisted = true;
      next.skipped = false;
      break;
    case "watched":
      next.watched = true;
      next.skipped = false;
      next.watchlisted = false;
      break;
    case "removed_from_watchlist":
      next.watchlisted = false;
      next.liked = false;
      break;
  }
  return next;
}
