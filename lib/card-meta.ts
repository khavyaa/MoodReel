import type { DeckCard } from "@/lib/deck/build-movies";
import { formatRuntime } from "@/lib/picks/why";

/*
 * The small facts line on every card. Films: year · language · runtime.
 * Series: year · language · seasons · episode length.
 */

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function cardMeta(card: DeckCard): string {
  if (card.series) {
    const s = card.series;
    return [
      card.year,
      card.languageLabel,
      s.seasons ? plural(s.seasons, "season") : null,
      s.episodeRuntime ? `${s.episodeRuntime}-min episodes` : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }
  return [card.year, card.languageLabel, formatRuntime(card.runtime)].filter(Boolean).join(" · ");
}

/** "Still airing · 2 seasons so far" for a show with more to come. */
export function airingLabel(card: DeckCard): string | null {
  if (!card.series?.ongoing) return null;
  return `Still airing · ${plural(card.series.seasons, "season")} so far`;
}

/** Who made it: directors for films, creators for series. */
export function makersLabel(card: DeckCard): string | null {
  if (!card.directors.length) return null;
  return `${card.series ? "Created by" : "Directed by"} ${card.directors.slice(0, 2).join(" & ")}`;
}

/** Where to start a series tonight. */
export function startLine(card: DeckCard): string | null {
  const s = card.series;
  if (!s) return null;
  const parts = [
    s.firstSeasonEpisodes ? plural(s.firstSeasonEpisodes, "episode") : null,
    s.episodeRuntime ? `about ${s.episodeRuntime} min each` : null,
    s.seasons > 1 ? `${plural(s.seasons, "season")}${s.ongoing ? " so far, still airing" : " in all"}` : s.ongoing ? "more coming" : null,
  ];
  return parts.filter(Boolean).join(" · ");
}
