import "server-only";
import { lovedTitles } from "@/lib/picks/server";
import { getMovieDetails } from "@/lib/tmdb/movies";
import { getSeriesDetails } from "@/lib/tmdb/series";
import { booksByWork } from "@/lib/books/openlibrary";
import { suggestPeople } from "./rules";
import { personKey, type Person } from "./types";

/** "You've loved 3 films by David Fincher. Follow him?": from your saves, picks and high ratings. */
export async function peopleSuggestions(userId: string, known: Set<string>) {
  const loved = await lovedTitles(userId);
  const peopleOf = async (t: { id: number; media: string }): Promise<{ people: Person[] } | null> => {
    try {
      if (t.media === "movie") return { people: (await getMovieDetails(t.id)).people };
      if (t.media === "series") return { people: (await getSeriesDetails(t.id)).people };
      return null;
    } catch {
      return null;
    }
  };
  const books = loved.filter((t) => t.media === "book").map((t) => t.id);
  const [screen, found] = await Promise.all([
    Promise.all(loved.filter((t) => t.media !== "book").map(peopleOf)),
    booksByWork(books).catch(() => new Map()),
  ]);
  const titles = [
    ...screen.flatMap((x) => (x ? [x] : [])),
    ...[...found.values()].map((b) => ({
      people: b.authorIds.map((a: { id: number; name: string }) => ({ source: "openlibrary" as const, id: a.id, name: a.name, role: "author" as const })),
    })),
  ];
  return suggestPeople(titles, known);
}

export { personKey };
