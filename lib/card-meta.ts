import type { DeckCard } from "@/lib/deck/build-movies";
import { formatRuntime } from "@/lib/picks/why";

/*
 * The small facts line on every card. Films: year · language · runtime.
 * Series: year · language · seasons · episode length.
 */

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const LENGTH = (pages: number) => (pages < 250 ? "Short" : pages < 450 ? "Medium" : "Long");

export function cardMeta(card: DeckCard): string {
  if (card.book) {
    const pages = card.book.pages;
    return [card.year, pages ? `${pages} pages` : null, pages ? LENGTH(pages) : null].filter(Boolean).join(" · ");
  }
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

/** Who made it: directors for films, creators for series, authors for books. */
export function makersLabel(card: DeckCard): string | null {
  if (!card.directors.length) return null;
  const by = card.book ? "by" : card.series ? "Created by" : "Directed by";
  return `${by} ${card.directors.slice(0, 2).join(" & ")}`;
}

/** "NYT bestseller · 34 weeks" for a book that made the lists. */
export function bestsellerLabel(card: DeckCard): string | null {
  const weeks = card.book?.nytWeeks ?? 0;
  if (weeks <= 0) return null;
  return weeks === 1 ? "NYT bestseller" : `NYT bestseller · ${weeks} weeks`;
}

/** Ratings line: TMDb votes out of 10, or Open Library ratings out of 5. */
/** Films and series are rated out of 10 (TMDb), books out of 5 (Open Library). */
export const ratingScale = (card: Pick<DeckCard, "book">) => (card.book ? "/5" : "/10");

export const ratingCountLabel = (card: DeckCard) => `${card.votes.toLocaleString("en-IN")} ${card.book ? "ratings" : "votes"}`;

/** Where to start a book tonight: its length. */
export function readLine(card: DeckCard): string | null {
  const pages = card.book?.pages;
  if (!pages) return null;
  const band = LENGTH(pages);
  return band === "Short" ? `A short one: ${pages} pages` : band === "Medium" ? `${pages} pages` : `A long one: ${pages} pages`;
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
