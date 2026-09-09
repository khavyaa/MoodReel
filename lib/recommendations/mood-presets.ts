/**
 * Rule-based mood -> TMDb discover filters. Deliberately explainable: no model,
 * no paid AI call, just genre / keyword / quality gates we can tune from swipes.
 */
export type MoodPreset = {
  id: MoodId;
  label: string;
  blurb: string;
  emoji: string;
  /** TMDb genre ids, OR-ed in discover. */
  genres: string[];
  /** Genres that disqualify a result entirely. */
  excludeGenres?: string[];
  keywords?: string[];
  minVoteCount?: number;
  minVoteAverage?: number;
  maxVoteAverage?: number;
  releaseDateGte?: string;
  releaseDateLte?: string;
  sortBy?: string;
};

export const MOOD_IDS = [
  "edgeOfSeat",
  "darkAndIntense",
  "lightAndFunny",
  "romantic",
  "feelGood",
  "mindBending",
  "emotional",
  "familyNight",
  "classicRewatch",
  "hiddenGems",
] as const;

export type MoodId = (typeof MOOD_IDS)[number];

export const MOOD_PRESETS: Record<MoodId, MoodPreset> = {
  edgeOfSeat: {
    id: "edgeOfSeat",
    label: "Edge of seat",
    blurb: "Thrillers, heists and chases that will not let you sit back.",
    emoji: "🎬",
    genres: ["53", "80", "9648", "28"],
    minVoteCount: 100,
    sortBy: "popularity.desc",
  },
  darkAndIntense: {
    id: "darkAndIntense",
    label: "Dark and intense",
    blurb: "Heavy, morally messy stories with teeth.",
    emoji: "🌑",
    genres: ["18", "53", "80"],
    excludeGenres: ["35", "10751", "16"],
    minVoteAverage: 6.5,
    minVoteCount: 75,
    sortBy: "vote_average.desc",
  },
  lightAndFunny: {
    id: "lightAndFunny",
    label: "Light and funny",
    blurb: "Low stakes, high laughs, nothing to recover from.",
    emoji: "😄",
    genres: ["35"],
    excludeGenres: ["27", "53"],
    minVoteCount: 50,
    sortBy: "popularity.desc",
  },
  romantic: {
    id: "romantic",
    label: "Romantic",
    blurb: "Love stories, slow burns and grand gestures.",
    emoji: "💌",
    genres: ["10749"],
    minVoteCount: 50,
    sortBy: "popularity.desc",
  },
  feelGood: {
    id: "feelGood",
    label: "Feel-good",
    blurb: "Warm films that leave you lighter than they found you.",
    emoji: "🌤️",
    genres: ["35", "18", "10751"],
    excludeGenres: ["27", "80"],
    minVoteAverage: 6.3,
    minVoteCount: 80,
    sortBy: "popularity.desc",
  },
  mindBending: {
    id: "mindBending",
    label: "Mind-bending",
    blurb: "Puzzles, timelines and endings you will argue about.",
    emoji: "🌀",
    genres: ["878", "9648", "53"],
    minVoteAverage: 6.5,
    minVoteCount: 150,
    sortBy: "vote_count.desc",
  },
  emotional: {
    id: "emotional",
    label: "Emotional",
    blurb: "Films that go straight for the throat.",
    emoji: "🥲",
    genres: ["18", "10749", "10752"],
    minVoteAverage: 6.8,
    minVoteCount: 100,
    sortBy: "vote_average.desc",
  },
  familyNight: {
    id: "familyNight",
    label: "Family night",
    blurb: "Safe for the room, good enough for the adults.",
    emoji: "🍿",
    genres: ["10751", "16", "12"],
    excludeGenres: ["27", "53", "80"],
    minVoteAverage: 6.2,
    minVoteCount: 100,
    sortBy: "popularity.desc",
  },
  classicRewatch: {
    id: "classicRewatch",
    label: "Classic rewatch",
    blurb: "Older, proven, worth a second look.",
    emoji: "📼",
    genres: [],
    releaseDateLte: "2010-12-31",
    minVoteAverage: 7.2,
    minVoteCount: 300,
    sortBy: "vote_average.desc",
  },
  hiddenGems: {
    id: "hiddenGems",
    label: "Hidden gems",
    blurb: "Well-loved films that never got their crowd.",
    emoji: "💎",
    genres: [],
    minVoteAverage: 7.0,
    minVoteCount: 40,
    sortBy: "vote_average.desc",
  },
};

export const MOOD_LIST = MOOD_IDS.map((id) => MOOD_PRESETS[id]);

export function isMoodId(value: unknown): value is MoodId {
  return typeof value === "string" && (MOOD_IDS as readonly string[]).includes(value);
}

/**
 * Hidden gems is the one preset that also needs an upper popularity bound;
 * TMDb has no such filter, so we cap it during ranking instead.
 */
export const HIDDEN_GEM_MAX_POPULARITY = 40;
