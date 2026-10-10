import type { ActionKind } from "@/lib/taste/profile";

/*
 * A title's state as a fold over its action log. Swipes write state directly;
 * undo deletes the last action and rebuilds the state from what's left, so the
 * two can never disagree.
 */

export type TitleFlags = {
  saved: boolean;
  seen: boolean;
  skipped: boolean;
  disliked: boolean;
  pickedAt: Date | null;
};

export const EMPTY_FLAGS: TitleFlags = { saved: false, seen: false, skipped: false, disliked: false, pickedAt: null };

/** What one action does to a title's flags. Swipes and library changes both go through here. */
export function applyAction(flags: TitleFlags, action: ActionKind, at: Date): TitleFlags {
  switch (action) {
    case "saved":
      return { ...flags, saved: true, skipped: false };
    case "skipped":
      return { ...flags, skipped: true };
    case "seen":
      return { ...flags, seen: true, saved: false };
    case "disliked":
      return { ...flags, disliked: true, saved: false };
    case "picked":
      return { ...flags, pickedAt: at, saved: false };
    case "unsaved":
      return { ...flags, saved: false };
    case "finished":
      return { ...flags, seen: true, saved: false };
    case "dropped":
      return { ...flags, disliked: true, saved: false };
  }
}

/** Replays a title's actions, oldest first. */
export function foldActions(actions: { action: ActionKind; createdAt: Date }[]): TitleFlags {
  return actions.reduce((flags, a) => applyAction(flags, a.action, a.createdAt), EMPTY_FLAGS);
}
