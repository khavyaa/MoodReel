import { describe, expect, it } from "vitest";
import {
  bookGate,
  bookMoodFit,
  bookRating,
  capAuthorsAndClassics,
  eraFit,
  fitsLength,
  hasNeverSubject,
  nytWeeksFromSubjects,
  type BookCandidate,
} from "@/lib/books/rules";
import { bookSearchParams, isOmnibus, looksEnglish, tidyTitle } from "@/lib/books/openlibrary";
import { adultEntries, pastSundays } from "@/lib/books/nyt";
import { bestsellerLabel, cardMeta, readLine } from "@/lib/card-meta";
import { ruleBasedWhy } from "@/lib/picks/why";
import { bookSearchUrl } from "@/lib/watch";
import type { DeckCard } from "@/lib/deck/build-movies";

function book(over: Partial<BookCandidate> = {}): BookCandidate {
  return {
    id: 1,
    title: "Book",
    originalTitle: "Book",
    language: "en",
    year: 2018,
    releaseDate: "2018-01-01",
    genreIds: [],
    overview: "",
    posterPath: null,
    backdropPath: null,
    voteAverage: 4.3,
    voteCount: 120,
    popularity: 0,
    onMyServices: false,
    authors: ["A. Author"],
    authorIds: [{ id: 1, name: "A. Author" }],
    pages: 340,
    subjects: ["Fiction", "Thriller", "Suspense"],
    ratingsCount: 120,
    readCount: 300,
    nytWeeks: 0,
    ...over,
  };
}

describe("book gate", () => {
  it("keeps out children's, YA, romance, self-help, business and comics", () => {
    expect(hasNeverSubject(["Juvenile fiction"])).toBe(true);
    expect(hasNeverSubject(["Young adult fiction"])).toBe(true);
    expect(hasNeverSubject(["Fiction, romance, contemporary"])).toBe(true);
    expect(hasNeverSubject(["Self-help techniques"])).toBe(true);
    expect(hasNeverSubject(["Success in business"])).toBe(true);
    expect(hasNeverSubject(["Graphic novels"])).toBe(true);
    // Batman: Year One carries a comics class code, not a "comics" subject.
    expect(hasNeverSubject(["Batman (Fictitious character)", "741.5/973"])).toBe(true);
    // A "comic novel" isn't a comic book.
    expect(hasNeverSubject(["Comic fiction", "Satire"])).toBe(false);
  });

  it("needs enough good ratings, or a lasting bestseller readers don't dislike", () => {
    expect(bookGate(book()).ok).toBe(true);
    expect(bookGate(book({ voteAverage: 3.5 })).ok).toBe(false);
    expect(bookGate(book({ voteCount: 2 })).ok).toBe(false);
    expect(bookGate(book({ voteCount: 2, nytWeeks: 12 })).ok).toBe(true);
    expect(bookGate(book({ voteCount: 40, voteAverage: 3.4, nytWeeks: 12 })).ok).toBe(false);
  });

  it("pulls thinly rated books towards a typical rating", () => {
    expect(bookRating(book({ voteAverage: 5, voteCount: 3 }))).toBeLessThan(4.2);
    expect(bookRating(book({ voteAverage: 4.5, voteCount: 500 }))).toBeGreaterThan(4.4);
  });
});

describe("book moods, length and era", () => {
  it("a Christie mystery tagged 'Humour' isn't funny; a satire is", () => {
    expect(bookMoodFit(book({ subjects: ["Mystery", "Humour", "Serial murders"] }), "funny")).toBe(0);
    expect(bookMoodFit(book({ subjects: ["Satire", "Fiction"] }), "funny")).toBeGreaterThan(0);
    expect(bookMoodFit(book({ subjects: ["Friendship", "Murder"] }), "feelgood")).toBe(0);
  });

  it("length bands: short under 250 pages, long 450 and up", () => {
    expect(fitsLength(240, 0)).toBe(true);
    expect(fitsLength(250, 0)).toBe(false);
    expect(fitsLength(340, 1)).toBe(true);
    expect(fitsLength(450, 2)).toBe(true);
    expect(fitsLength(null, 1)).toBe(true);
    expect(fitsLength(null, 0)).toBe(false);
  });

  it("leans modern, and keeps one book per author and only a couple of classics", () => {
    expect(eraFit(2015, 2026)).toBeGreaterThan(eraFit(1950, 2026));
    const ranked = [
      book({ id: 1, authors: ["Pratchett"] }),
      book({ id: 2, authors: ["Pratchett"] }),
      book({ id: 3, authors: ["Austen"], year: 1813 }),
      book({ id: 4, authors: ["Bronte"], year: 1847 }),
      book({ id: 5, authors: ["Dickens"], year: 1859 }),
      book({ id: 6, authors: ["Weir"] }),
    ].map((movie) => ({ movie, score: 1 }));
    expect(capAuthorsAndClassics(ranked, 2026).map((r) => r.movie.id)).toEqual([1, 3, 4, 6]);
  });
});

describe("Open Library data", () => {
  it("tidies edition titles", () => {
    expect(tidyTitle("Queen's Gambit,the")).toBe("The Queen's Gambit");
    expect(tidyTitle("The Trial (Penguin Books. no. 907.)")).toBe("The Trial");
    expect(tidyTitle("A man called ove")).toBe("A Man Called Ove");
    expect(tidyTitle("11/22/63")).toBe("11/22/63");
  });

  it("drops non-English descriptions and omnibus editions", () => {
    expect(looksEnglish("Kriminalroman. Miamipolitiet og politiofficer Debora Morgan er på sporet af en seriemorder")).toBe(false);
    expect(looksEnglish("Alicia Berenson's life is seemingly perfect, and then one evening she shoots her husband")).toBe(true);
    expect(isOmnibus("Works", 815)).toBe(true);
    expect(isOmnibus("Mistborn", 1712)).toBe(true);
    expect(isOmnibus("The Hunger Box", 300)).toBe(false);
  });

  it("reads NYT weeks from Open Library's subject tags", () => {
    expect(nytWeeksFromSubjects(["nyt:hardcover-fiction=2019-03-03", "nyt:e-book-fiction=2019-03-03", "nyt:hardcover-fiction=2019-03-10", "Fiction"])).toBe(2);
  });

  it("searches only the length asked for, with the never-subjects excluded in the query", () => {
    const params = bookSearchParams({ subjects: ["thriller"], never: "-subject:romance", pages: [250, 449], minRatings: 20, sort: "rating", page: 1 });
    expect(params.q).toContain('subject:"thriller"');
    expect(params.q).toContain("number_of_pages_median:[250 TO 449]");
    expect(params.q).toContain("language:eng");
    expect(params.q).toContain("-subject:romance");
  });
});

describe("NYT lists", () => {
  it("keeps adult lists only", () => {
    const entries = adultEntries({
      published_date: "2026-10-04",
      lists: [
        { list_name_encoded: "hardcover-fiction", books: [{ primary_isbn13: "1", title: "A", author: "X", rank: 1, weeks_on_list: 5 }] },
        { list_name_encoded: "young-adult-hardcover", books: [{ primary_isbn13: "2", title: "B", author: "Y", rank: 1, weeks_on_list: 9 }] },
        { list_name_encoded: "advice-how-to-and-miscellaneous", books: [{ primary_isbn13: "3", title: "C", author: "Z", rank: 1, weeks_on_list: 9 }] },
      ],
    });
    expect(entries.map((e) => e.isbn13)).toEqual(["1"]);
  });

  it("backfills week by week from the latest Sunday", () => {
    expect(pastSundays(new Date("2026-10-08T12:00:00Z"), 3)).toEqual(["2026-10-04", "2026-09-27", "2026-09-20"]);
  });
});

describe("book cards and reasons", () => {
  const card: DeckCard = {
    media: "book",
    id: 1,
    title: "Piranesi",
    originalTitle: "Piranesi",
    year: 2020,
    language: "en",
    languageLabel: "English",
    overview: "",
    posterPath: "ol:10520611",
    backdropPath: null,
    rating: 4.3,
    votes: 63,
    genreIds: [],
    genres: ["Fantasy", "Mystery"],
    runtime: null,
    directors: ["Susanna Clarke"],
    cast: [],
    streamingOn: [],
    gate: null,
    trailerKey: null,
    series: null,
    book: { authors: ["Susanna Clarke"], pages: 272, nytWeeks: 6, subjects: ["Fantasy"], tags: ["s:fantasy"] },
    people: [{ source: "openlibrary", id: 1, name: "Susanna Clarke", role: "author" }],
  };

  it("shows pages, length and bestseller weeks", () => {
    expect(cardMeta(card)).toBe("2020 · 272 pages · Medium");
    expect(readLine({ ...card, book: { ...card.book!, pages: 200 } })).toBe("A short one: 200 pages");
    expect(bestsellerLabel(card)).toBe("NYT bestseller · 6 weeks");
  });

  it("explains a book pick in book terms, and links to Amazon India's books", () => {
    const why = ruleBasedWhy({ ...card, mood: "mind", energy: 1, beat: 3, book: { authors: ["Susanna Clarke"], pages: 272, nytWeeks: 6 } });
    expect(why).toContain("It beat 3 other books");
    expect(why).toContain("by Susanna Clarke");
    expect(why).toContain("6 weeks a New York Times bestseller");
    expect(bookSearchUrl("Piranesi", ["Susanna Clarke"])).toBe("https://www.amazon.in/s?k=Piranesi%20Susanna%20Clarke&i=stripbooks");
  });
});
