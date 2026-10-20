import type { MovieCandidate } from "@/lib/taste/types";

/*
 * Turns scored candidates into a deck. Pure, so the mix rules are testable.
 *
 * You watch mostly English, so a deck is about two-thirds English. Tamil,
 * Malayalam and Hindi films fill the rest (if enough pass your rules), spread
 * evenly through the deck rather than bunched at the end. If one side runs
 * short, the other tops the deck up so it's still full.
 */

export const DECK_SIZE = 15;
export const ENGLISH_SHARE = 2 / 3;

export type Scored<T extends MovieCandidate = MovieCandidate> = { movie: T; score: number };

/** Small, repeatable noise so two deals for the same taps don't look identical. */
export function jitter(seed: number, id: number): number {
  const x = Math.sin(seed * 12.9898 + id * 78.233) * 43758.5453;
  return (x - Math.floor(x) - 0.5) * 0.04;
}

/**
 * Takes turns between languages, best first within each, so one language can't
 * fill every non-English slot when films in the others fit too. Input best-first;
 * languages take turns in the order of their best candidate.
 */
export function spreadLanguages<T extends { movie: MovieCandidate }>(ranked: T[]): T[] {
  const groups = new Map<string, T[]>();
  for (const r of ranked) groups.set(r.movie.language, [...(groups.get(r.movie.language) ?? []), r]);
  const queues = [...groups.values()];
  const out: T[] = [];
  for (let i = 0; out.length < ranked.length; i++) for (const q of queues) if (q[i]) out.push(q[i]);
  return out;
}

export function composeDeck<T extends MovieCandidate>(
  scored: Scored<T>[],
  { size = DECK_SIZE, englishShare = ENGLISH_SHARE, seed = 1 } = {},
): T[] {
  const ranked = [...scored]
    .map((s) => ({ ...s, score: s.score + jitter(seed, s.movie.id) }))
    .sort((a, b) => b.score - a.score || a.movie.id - b.movie.id);

  const english = ranked.filter((s) => s.movie.language === "en");
  const others = spreadLanguages(ranked.filter((s) => s.movie.language !== "en"));

  const targetOthers = Math.round(size * (1 - englishShare));
  let takeOthers = Math.min(others.length, targetOthers);
  const takeEnglish = Math.min(english.length, size - takeOthers);
  takeOthers = Math.min(others.length, size - takeEnglish);

  const pickedEnglish = english.slice(0, takeEnglish).map((s) => s.movie);
  const pickedOthers = others.slice(0, takeOthers).map((s) => s.movie);
  const total = pickedEnglish.length + pickedOthers.length;

  // Place the minority evenly: slot i holds a minority card when its share of
  // the deck so far falls behind its share of the whole.
  const [minority, majority] =
    pickedOthers.length <= pickedEnglish.length ? [pickedOthers, pickedEnglish] : [pickedEnglish, pickedOthers];
  const deck: T[] = [];
  let m = 0;
  let M = 0;
  for (let i = 0; i < total; i++) {
    const due = Math.floor(((i + 1) * minority.length) / total) > m;
    if ((due && m < minority.length) || M >= majority.length) deck.push(minority[m++]);
    else deck.push(majority[M++]);
  }
  return deck;
}
