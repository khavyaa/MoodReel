import { describe, expect, it } from "vitest";
import { birthYearOf, dedupeAuthors, tidyBibliography } from "@/lib/books/openlibrary";
import type { BookCandidate } from "@/lib/books/rules";

function book(id: number, title: string, extra: Partial<BookCandidate> = {}): BookCandidate {
  return {
    id,
    title,
    originalTitle: title,
    language: "en",
    year: 2005,
    releaseDate: "2005-01-01",
    genreIds: [],
    overview: "",
    posterPath: null,
    backdropPath: null,
    voteAverage: 4,
    voteCount: 20,
    popularity: 100,
    onMyServices: false,
    authors: ["Mitch Albom"],
    authorIds: [{ id: 1, name: "Mitch Albom" }],
    pages: 220,
    subjects: ["Fiction"],
    ratingsCount: 20,
    readCount: 100,
    nytWeeks: 0,
    ...extra,
  };
}

describe("an author's page", () => {
  it("drops sets, adaptations, textbook editions, anthologies and entries nobody has read", () => {
    const kept = tidyBibliography(
      [
        book(1, "Tuesdays with Morrie"),
        book(2, "Mitch Albom 7 Title Set"),
        book(3, "The Five People You Meet in Heaven", { originalTitle: "The Five People You Meet in Heaven [adaptation]" }),
        book(4, "Subject & strategy -- fourteenth edition"),
        book(5, "Literature, Reading and Writing", { subjects: ["English literature, study and teaching"] }),
        book(6, "Viewpoints", { authors: ["A", "B", "Mitch Albom"] }),
        book(7, "Live Albom III", { readCount: 0, ratingsCount: 0, pages: null }),
        book(8, "For One More Day"),
      ],
      1958,
    );
    expect(kept.map((b) => b.id)).toEqual([1, 8]);
  });

  it("keeps one of each title, the most read (input order), however it's capitalised", () => {
    const kept = tidyBibliography([book(1, "Fab Five"), book(2, "fab five", { year: 2009 }), book(3, "The Time Keeper"), book(4, "Time keeper")], null);
    expect(kept.map((b) => b.id)).toEqual([1, 3]);
  });

  it("blanks a first-published year from before the author was 12", () => {
    const [faith, morrie] = tidyBibliography([book(1, "Have a Little Faith", { year: 1960 }), book(2, "Tuesdays with Morrie", { year: 1994 })], 1958);
    expect(faith.year).toBeNull();
    expect(morrie.year).toBe(1994);
    expect(tidyBibliography([book(1, "Old", { year: 1900 })], null)[0].year).toBe(1900);
  });

  it("reads a birth year from Open Library's free-text dates", () => {
    expect(birthYearOf("23 May 1958")).toBe(1958);
    expect(birthYearOf("1958")).toBe(1958);
    expect(birthYearOf(undefined)).toBeNull();
    expect(birthYearOf("unknown")).toBeNull();
  });
});

describe("author search", () => {
  it("keeps one record per name, the one with the most works", () => {
    const docs = [
      { key: "/authors/OL9A", name: "Mitch Albom", work_count: 3 },
      { key: "/authors/OL1A", name: "Mitch  Albom", work_count: 120 },
      { key: "/authors/OL2A", name: "Mitch Cullin", work_count: 30 },
    ];
    expect(dedupeAuthors(docs).map((a) => a.key)).toEqual(["/authors/OL1A", "/authors/OL2A"]);
  });
});
