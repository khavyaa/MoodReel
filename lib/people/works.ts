import "server-only";
import { authorWithBooks, bookDescription } from "@/lib/books/openlibrary";
import { bookGate, fitsLength, hasNeverSubject, scoreBook, type BookMood } from "@/lib/books/rules";
import type { DealResult, DeckCard } from "@/lib/deck/build-movies";
import { detailsById, movieCard } from "@/lib/deck/build-movies";
import { bookCard, withNytWeeks } from "@/lib/deck/build-books";
import { seriesCard } from "@/lib/deck/build-series";
import { DECK_SIZE } from "@/lib/deck/compose";
import { getSeriesDetails } from "@/lib/tmdb/series";
import { getTmdbPerson, type PersonWork } from "@/lib/tmdb/people";
import { fitsRuntime, isLanguage, passesGate, scoreMovie, type TasteProfile } from "@/lib/taste/rules";
import { fitsCommitment, scoreSeries, seriesGate, shortEnoughForHindi, type SeriesMood } from "@/lib/taste/series-rules";
import type { Taps } from "@/lib/taste/types";
import type { BookCandidate } from "@/lib/books/rules";
import type { Person, PersonSource } from "./types";

/*
 * One person's work, for their page and for "Deal from …". Your rules still
 * apply (languages, no soaps, no children's books), but not the quality bar or
 * the mood: it's their work you asked for.
 */

/**
 * All of a person's work that passes your rules, best known first. The page
 * shows the first PAGE_LIMIT of each; decks and the followed pool use it all,
 * so a long career doesn't run out once its best-known titles are handled.
 */
export type PersonPageData = {
  person: Person;
  films: PersonWork[];
  series: PersonWork[];
  books: BookCandidate[];
  /** Work left out by your language rules, by title, for the page's note. */
  hiddenByLanguage: string[];
};

/** How many titles of each kind a person's page lists. */
export const PAGE_LIMIT = 24;

export async function personWorks(source: PersonSource, id: number): Promise<PersonPageData | null> {
  if (source === "openlibrary") {
    const author = await authorWithBooks(id);
    if (!author) return null;
    const books = (await withNytWeeks(author.books)).filter((b) => !hasNeverSubject(b.subjects));
    return {
      person: { source, id, name: author.name, role: "author" },
      films: [],
      series: [],
      books,
      hiddenByLanguage: [],
    };
  }

  const p = await getTmdbPerson(id);
  const hidden: string[] = [];
  const films = p.movies.filter((w) => {
    if (!isLanguage(w.candidate.language)) {
      if (w.candidate.voteCount >= 50) hidden.push(w.candidate.title);
      return false;
    }
    return passesGate(w.candidate).ok;
  });
  const series = p.series.filter((w) => {
    if (w.candidate.language !== "en" && w.candidate.language !== "hi") {
      if (w.candidate.voteCount >= 50) hidden.push(w.candidate.title);
      return false;
    }
    return seriesGate(w.candidate).ok;
  });
  return {
    person: { source, id, name: p.name, role: p.role },
    films,
    series,
    books: [],
    hiddenByLanguage: hidden.slice(0, 6),
  };
}

type DeckOptions = { exclude: Set<number>; taste: TasteProfile; providers: number[]; followed: boolean };

/**
 * A deck from one person's work: what you haven't seen, saved or turned down,
 * within the time you have, best fit for the mood first. Usually fewer than 15.
 */
export async function buildPersonDeck(
  media: "movie" | "series" | "book",
  taps: Taps,
  person: { source: PersonSource; id: number },
  { exclude, taste, providers, followed }: DeckOptions,
): Promise<DealResult & { personName: string }> {
  const works = await personWorks(person.source, person.id);
  if (!works) throw new Error("That person couldn't be found.");
  const badge = followed ? works.person.name : null;
  let cards: DeckCard[] = [];

  if (media === "movie") {
    const open = works.films.filter((w) => !exclude.has(w.candidate.id)).slice(0, 30);
    const details = await detailsById(open.map((w) => w.candidate.id));
    cards = open
      .filter((w) => fitsRuntime(details.get(w.candidate.id)?.runtime, taps.time))
      .map((w) => ({ w, score: scoreMovie(w.candidate, taps, taste) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, DECK_SIZE)
      .map(({ w }) => movieCard(w.candidate, details.get(w.candidate.id) ?? null, providers, badge));
  } else if (media === "series") {
    const open = works.series.filter((w) => !exclude.has(w.candidate.id)).slice(0, 30);
    const settled = await Promise.allSettled(open.map((w) => getSeriesDetails(w.candidate.id)));
    const mood = taps.mood as SeriesMood;
    cards = settled
      .flatMap((r) => (r.status === "fulfilled" ? [r.value] : []))
      .filter((d) => fitsCommitment(d.facts, taps.time) && shortEnoughForHindi(d.facts, d.language))
      .map((d) => ({ d, score: scoreSeries(d.candidate, { ...taps, mood }, taste, d.facts) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, DECK_SIZE)
      .map(({ d }) => seriesCard(d, providers, false, badge));
  } else {
    const mood = taps.mood as BookMood;
    const open = works.books
      .filter((b) => !exclude.has(b.id) && fitsLength(b.pages, taps.time))
      .map((b) => ({ b, score: scoreBook(b, { ...taps, mood }, taste) + (bookGate(b).ok ? 0.1 : 0) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, DECK_SIZE);
    const descriptions = await Promise.all(open.map(({ b }) => bookDescription(b.id)));
    cards = open.map(({ b }, i) => bookCard(b, descriptions[i], badge));
  }

  return { cards, missingLanguages: [], curatedByAi: false, personName: works.person.name };
}

/** At most this many followed people are looked up per deal, most recently followed first. */
const FOLLOWED_LOOKUPS = 8;
/** Of each followed person's work, the best-known this many join the pool (the deck takes two at most). */
const FOLLOWED_PER_PERSON = 40;

/**
 * Followed people's work, as extra deck candidates: their films are often too
 * famous for the "lesser-seen" pools, so they'd rarely be dealt otherwise. The
 * deck's own rules (mood, language, quality) still decide what's eligible.
 */
export async function followedWork(media: "movie" | "series" | "book", follow: Map<string, string>) {
  const keys = [...follow.keys()].slice(0, FOLLOWED_LOOKUPS);
  const wanted = keys.filter((k) => (media === "book" ? k.startsWith("openlibrary:") : k.startsWith("tmdb:")));
  const lists = await Promise.all(
    wanted.map(async (key) => {
      const [source, id] = key.split(":");
      const works = await personWorks(source as PersonSource, Number(id)).catch(() => null);
      if (!works) return [];
      const all =
        media === "movie"
          ? works.films.map((w) => w.candidate)
          : media === "series"
            ? works.series.map((w) => w.candidate)
            : works.books;
      return all.slice(0, FOLLOWED_PER_PERSON);
    }),
  );
  return lists.flat();
}
