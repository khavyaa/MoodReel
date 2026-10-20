import type { TasteProfile } from "./rules";

/*
 * What your swipes and ratings teach the ranking. Each action nudges the tags
 * on the title (TMDb genre ids and `lang:xx`, or book subjects). A rating
 * counts once per title, from its current value: it lives on the title's
 * state, not in the action log, so re-rating replaces it instead of piling up
 * (in v1 re-rating inflated a genre).
 */

export type ActionKind = "saved" | "skipped" | "seen" | "disliked" | "picked" | "unsaved" | "finished" | "dropped";

export const ACTION_WEIGHT: Record<ActionKind, number> = {
  picked: 1.5,
  saved: 1,
  seen: 0.2,
  skipped: -0.15,
  unsaved: -0.3,
  disliked: -1,
  finished: 0.6,
  dropped: -1,
};

/**
 * A rating's pull, once per title: 5 stars (10) is +2, 3 stars (6) nothing,
 * 1 star (2) is -2. Enough for a one-star pick to cancel being picked, so
 * finishing something you didn't like stops teaching "more of this".
 */
export const RATING_WEIGHT = 2;
export const ratingWeight = (rating: number) => (RATING_WEIGHT * (Math.min(10, Math.max(1, rating)) - 6)) / 4;

export function buildTasteProfile(
  actions: { action: ActionKind; tags: string[] }[],
  ratings: { rating: number; tags: string[] }[] = [],
): TasteProfile {
  const sums: Record<string, number> = {};
  for (const { action, tags } of actions) {
    const w = ACTION_WEIGHT[action] ?? 0;
    for (const tag of tags) sums[tag] = (sums[tag] ?? 0) + w;
  }
  for (const { rating, tags } of ratings) {
    const w = ratingWeight(rating);
    for (const tag of tags) sums[tag] = (sums[tag] ?? 0) + w;
  }
  // tanh keeps any one tag in [-1, 1] however long the history gets.
  return { tags: Object.fromEntries(Object.entries(sums).map(([tag, v]) => [tag, Math.tanh(v / 4)])) };
}
