/*
 * The head-to-head: the first save holds the title, each other save challenges
 * it once. Winner stays on. With 4 saves that's 3 rounds, and you're never
 * asked to compare more than two things at a time.
 */

export const MAX_SAVES = 4;

export type Finale<T> = {
  champion: T;
  challengers: T[];
  round: number;
  rounds: number;
};

/** Null when there's nothing to compare: zero saves, or one (which is the pick). */
export function startFinale<T>(shortlist: T[]): Finale<T> | null {
  if (shortlist.length < 2) return null;
  const [champion, ...challengers] = shortlist;
  return { champion, challengers, round: 1, rounds: challengers.length };
}

export type FinaleStep<T> = { done: false; finale: Finale<T> } | { done: true; winner: T };

export function choose<T>(finale: Finale<T>, side: "champion" | "challenger"): FinaleStep<T> {
  const [challenger, ...rest] = finale.challengers;
  const champion = side === "champion" ? finale.champion : challenger;
  if (rest.length === 0) return { done: true, winner: champion };
  return { done: false, finale: { champion, challengers: rest, round: finale.round + 1, rounds: finale.rounds } };
}

/** The deck ends early once you've saved enough to choose between. */
export function deckIsDone(dealt: number, deckSize: number, saves: number): boolean {
  return saves >= MAX_SAVES || dealt >= deckSize;
}
