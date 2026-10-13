import { describe, expect, it } from "vitest";
import {
  DISLIKED_BOOK,
  NO_ADAPT,
  READ_BOOST,
  SEEN_SCREEN_PENALTY,
  bonusByBook,
  bonusByScreen,
  capFromBooks,
  keepAdaptations,
  knows,
  parseWikidataCsv,
  screenBonus,
} from "@/lib/adaptations/rules";

const read = { seen: true, rating: null, disliked: false };
const unread = { seen: false, rating: null, disliked: false };

describe("adaptation rules", () => {
  it("knows a story from a Read it / Seen it swipe or a rating", () => {
    expect(knows(read)).toBe(true);
    expect(knows({ ...unread, rating: 8 })).toBe(true);
    expect(knows(unread)).toBe(false);
    expect(knows(undefined)).toBe(false);
  });

  it("boosts a film of a book you read, more if you rated it well, and lowers one you disliked", () => {
    expect(screenBonus(read)).toBe(READ_BOOST);
    expect(screenBonus({ ...read, rating: 10 })).toBeCloseTo(0.18);
    expect(screenBonus({ ...read, rating: 10 })).toBeGreaterThan(screenBonus({ ...read, rating: 6 }));
    expect(screenBonus({ ...read, rating: 4 })).toBe(DISLIKED_BOOK);
    expect(screenBonus({ ...unread, disliked: true })).toBe(DISLIKED_BOOK);
    // Only saved, not read: no change.
    expect(screenBonus(unread)).toBe(0);
    expect(screenBonus(undefined)).toBe(0);
  });

  it("only the linked title moves: films of read books, books of seen films", () => {
    const links = [
      { bookId: 1, screenId: 10 },
      { bookId: 2, screenId: 20 },
      { bookId: 3, screenId: 10 }, // a second book for film 10, unread
    ];
    const byScreen = bonusByScreen(links, new Map([[1, read]]));
    expect([...byScreen]).toEqual([[10, READ_BOOST]]);

    const byBook = bonusByBook(links, new Map([[20, read]]));
    expect([...byBook]).toEqual([[2, -SEEN_SCREEN_PENALTY]]);
    // A film you only turned down doesn't mean you know the story.
    expect([...bonusByBook(links, new Map([[20, { ...unread, disliked: true }]]))]).toEqual([]);
  });

  it("adaptations only keeps linked or TMDb-tagged titles, and does nothing when off", () => {
    const items = [1, 2, 3, 4];
    const filter = { ...NO_ADAPT, linked: new Set([1]), only: true };
    expect(keepAdaptations(items, (n) => n, filter, new Set([3]))).toEqual([1, 3]);
    expect(keepAdaptations(items, (n) => n, { ...filter, only: false })).toEqual(items);
  });

  it("caps films of read books per deck, keeping the best", () => {
    const ranked = ["b1", "x", "b2", "b3", "y", "b4"];
    expect(capFromBooks(ranked, (s) => s.startsWith("b"), 3)).toEqual(["b1", "x", "b2", "b3", "y"]);
  });

  it("reads Wikidata's CSV: works and editions, nothing else", () => {
    const csv = "tmdb,ol\r\n210577,OL35889560M\n14704,OL503666W\n281199,OL511786A\nnope,OL1W\n12,\n";
    expect(parseWikidataCsv(csv)).toEqual([
      { screenId: 210577, ol: "OL35889560M" },
      { screenId: 14704, ol: "OL503666W" },
    ]);
  });
});
