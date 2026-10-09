import type { Scored } from "./compose";

/*
 * How an AI opinion is folded into the deck. The AI only re-weights: films it
 * says fit the mood get a boost by rank, films it passed over get nudged down.
 * The language mix, your gates and the deck size still come from the rules
 * afterwards, so a bad or missing AI answer can never break a deck.
 */

export const CURATION_BOOST = 0.3;
export const CURATION_PENALTY = 0.15;
/** Fewer approvals than this and the answer is ignored as unreliable. */
export const MIN_APPROVED = 8;

/** Keeps only ids we actually offered, once each, in the AI's order. */
export function validCuration(approved: unknown, offered: Set<number>): number[] | null {
  if (!Array.isArray(approved)) return null;
  const seen = new Set<number>();
  const out: number[] = [];
  for (const id of approved) {
    if (typeof id === "number" && offered.has(id) && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out.length >= MIN_APPROVED ? out : null;
}

export function applyCuration<T extends Scored>(scored: T[], approved: number[] | null, offered: Set<number>): T[] {
  if (!approved) return scored;
  const rank = new Map(approved.map((id, i) => [id, i]));
  return scored.map((s) => {
    const r = rank.get(s.movie.id);
    if (r !== undefined) return { ...s, score: s.score + CURATION_BOOST * (1 - r / approved.length) };
    if (offered.has(s.movie.id)) return { ...s, score: s.score - CURATION_PENALTY };
    return s;
  });
}
