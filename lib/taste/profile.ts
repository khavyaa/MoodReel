import type { TasteProfile } from "./rules";

/*
 * What your swipes teach the ranking. Each action nudges the tags on the title
 * (TMDb genre ids and `lang:xx`). Ratings are deliberately absent: changing a
 * rating updates the title's state, never this log, so re-rating can't inflate
 * a genre the way it did in v1.
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

export function buildTasteProfile(actions: { action: ActionKind; tags: string[] }[]): TasteProfile {
  const sums: Record<string, number> = {};
  for (const { action, tags } of actions) {
    const w = ACTION_WEIGHT[action] ?? 0;
    for (const tag of tags) sums[tag] = (sums[tag] ?? 0) + w;
  }
  // tanh keeps any one tag in [-1, 1] however long the history gets.
  return { tags: Object.fromEntries(Object.entries(sums).map(([tag, v]) => [tag, Math.tanh(v / 4)])) };
}
