import type { MoodId } from "@/lib/moods";

export type Language = "en" | "hi" | "ta" | "ml";

export const LANGUAGE_LABEL: Record<string, string> = {
  en: "English",
  hi: "Hindi",
  ta: "Tamil",
  ml: "Malayalam",
};

/** A movie as the recommender sees it, before any per-card details are fetched. */
export type MovieCandidate = {
  id: number;
  title: string;
  originalTitle: string;
  language: string;
  year: number | null;
  releaseDate: string | null;
  genreIds: number[];
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  voteAverage: number;
  voteCount: number;
  popularity: number;
  /** Came from a query restricted to your streaming services. */
  onMyServices: boolean;
};

export type Taps = { mood: MoodId; energy: 0 | 1 | 2; time: 0 | 1 | 2 };

/** Why a non-English movie was allowed in, shown on its card. */
export type GateReason = "crime/thriller" | "acclaimed";
