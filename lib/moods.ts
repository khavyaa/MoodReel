/*
 * The vocabulary of the three taps, shared by the UI and (from Phase 2) the
 * recommender. Colours come from the approved prototype: in the bold & playful
 * look the whole screen takes the mood's colour, in cinematic dark it becomes
 * the accent.
 */

export const MOODS = {
  gripping: { label: "Gripping", color: "#FF4A1C", ink: "#1C0A05" },
  dark: { label: "Dark", color: "#3330D9", ink: "#F3F2FF" },
  mind: { label: "Mind-bending", color: "#7B3DFF", ink: "#FBF9FF" },
  funny: { label: "Funny", color: "#A9E033", ink: "#122004" },
  feelgood: { label: "Feel-good", color: "#FFC633", ink: "#241A00" },
  moving: { label: "Moving", color: "#12A88F", ink: "#03201A" },
  romantic: { label: "Romantic", color: "#FF5C9E", ink: "#29040F" },
} as const;

export type MoodId = keyof typeof MOODS;

export const ENERGY = ["Lean back", "In between", "Lean in"] as const;

/** URL segment → what it means. The database uses the singular `media` value. */
export const MEDIA = {
  movies: {
    media: "movie",
    label: "Movies",
    ask: "What kind of night is it?",
    result: "Tonight's pick",
    time: ["Under 100 min", "Around 2 hours", "Long is fine"],
    moods: ["gripping", "dark", "mind", "funny", "feelgood", "moving", "romantic"],
  },
  series: {
    media: "series",
    label: "Series",
    ask: "What are you settling into?",
    result: "Tonight's pick",
    time: ["Mini-series", "One season", "Long-runner"],
    moods: ["gripping", "dark", "mind", "funny", "feelgood", "moving"],
  },
  books: {
    media: "book",
    label: "Books",
    ask: "What do you feel like reading?",
    result: "Read next",
    time: ["Short · under 250 pages", "Medium", "Long · 450+ pages"],
    moods: ["gripping", "dark", "mind", "funny", "feelgood", "moving"],
  },
} as const satisfies Record<
  string,
  {
    media: "movie" | "series" | "book";
    label: string;
    ask: string;
    result: string;
    time: readonly [string, string, string];
    moods: readonly MoodId[];
  }
>;

export type MediaSlug = keyof typeof MEDIA;
export const MEDIA_SLUGS = Object.keys(MEDIA) as MediaSlug[];

export function isMediaSlug(value: string): value is MediaSlug {
  return value in MEDIA;
}

/** The brand colour when no mood is in play (sign-in, settings). */
export const BRAND_MOOD: MoodId = "gripping";
