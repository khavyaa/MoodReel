import "server-only";
import type { DealResult, DeckCard } from "@/lib/deck/build-movies";
import { detailsById, movieCard } from "@/lib/deck/build-movies";
import { bookCard, withNytWeeks } from "@/lib/deck/build-books";
import { seriesCard } from "@/lib/deck/build-series";
import { DECK_SIZE } from "@/lib/deck/compose";
import { bookDescription, booksByWork } from "@/lib/books/openlibrary";
import { bookMoodExcludes, fitsLength, scoreBook, type BookMood } from "@/lib/books/rules";
import { getSeriesDetails } from "@/lib/tmdb/series";
import { fitsRuntime, moodExcludes, moodFit, scoreMovie, type TasteProfile } from "@/lib/taste/rules";
import { fitsCommitment, scoreSeries, seriesMoodExcludes, seriesMoodFit, type SeriesMood } from "@/lib/taste/series-rules";
import type { Taps } from "@/lib/taste/types";
import { detailsToCandidate } from "@/lib/library";
import { listEntries } from "./server";

/** A list whose titles haven't loaded (Wikidata or TMDb didn't answer): nothing to deal from yet. */
export class ListNotLoaded extends Error {
  constructor() {
    super("That list hasn't loaded yet.");
  }
}

/** How many of a list's unseen titles are looked at for one deal (each needs its details). */
const LOOK_AT = 100;

/** Titles that fit the mood; a short deck beats one padded with misfits. All of them only if none fit. */
function moodFirst<T>(items: T[], fit: (item: T) => number): T[] {
  const fitting = items.filter((item) => fit(item) > 0);
  return fitting.length ? fitting : items;
}

/**
 * A deck from one list: what you haven't seen, saved or turned down, within
 * the time you have, best fit for the mood first. Your language rules don't
 * apply (it's the list you asked for), but a mood's hard exclusions do: no
 * crime films in a Funny deal, even from the Oscars. Films and series that
 * don't fit the mood at all are left out unless none do. Usually fewer than 15.
 */
export async function buildListDeck(
  media: "movie" | "series" | "book",
  taps: Taps,
  slug: string,
  { exclude, taste, providers }: { exclude: Set<number>; taste: TasteProfile; providers: number[] },
): Promise<DealResult & { listName: string }> {
  const list = await listEntries(slug);
  if (!list || list.def.media !== media) throw new Error("That list couldn't be found.");
  if (list.entries.length === 0) throw new ListNotLoaded();
  const open = list.entries.filter((e) => !exclude.has(e.id)).slice(0, LOOK_AT).map((e) => e.id);
  let cards: DeckCard[] = [];

  if (media === "movie") {
    const details = await detailsById(open);
    const allowed = open.flatMap((id) => {
      const d = details.get(id);
      const c = d && detailsToCandidate(d, providers);
      return d && c && fitsRuntime(d.runtime, taps.time) && !moodExcludes(c, taps.mood) ? [{ d, c }] : [];
    });
    cards = moodFirst(allowed, ({ c }) => moodFit(c, taps.mood))
      .map(({ d, c }) => ({ d, score: scoreMovie(c, taps, taste) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, DECK_SIZE)
      .map(({ d }) => movieCard(detailsToCandidate(d, providers), d, providers));
  } else if (media === "series") {
    const settled = await Promise.allSettled(open.map((id) => getSeriesDetails(id)));
    const mood = taps.mood as SeriesMood;
    const allowed = settled
      .flatMap((r) => (r.status === "fulfilled" ? [r.value] : []))
      .filter((d) => fitsCommitment(d.facts, taps.time) && !seriesMoodExcludes(d.candidate, mood));
    cards = moodFirst(allowed, (d) => seriesMoodFit(d.candidate, mood))
      .map((d) => ({ d, score: scoreSeries(d.candidate, { ...taps, mood }, taste, d.facts) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, DECK_SIZE)
      .map(({ d }) => seriesCard(d, providers, false));
  } else {
    const mood = taps.mood as BookMood;
    const found = await withNytWeeks([...(await booksByWork(open)).values()]);
    const best = found
      .filter((b) => fitsLength(b.pages, taps.time) && !bookMoodExcludes(b, mood))
      .map((b) => ({ b, score: scoreBook(b, { ...taps, mood }, taste) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, DECK_SIZE);
    const descriptions = await Promise.all(best.map(({ b }) => bookDescription(b.id)));
    cards = best.map(({ b }, i) => bookCard(b, descriptions[i]));
  }
  return { cards, missingLanguages: [], curatedByAi: false, listName: list.def.title };
}
