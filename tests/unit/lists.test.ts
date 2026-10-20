import { describe, expect, it } from "vitest";
import { listQuery, parseListCsv } from "@/lib/lists/sync";
import { LISTS, collectionSlug, listBySlug } from "@/lib/lists/catalog";

describe("lists", () => {
  it("reads Wikidata's answer: TMDb ids for films, Open Library works for books, each once, with the year it won", () => {
    expect(parseListCsv("id,year\r\n1001,2020\r\n1006,\r\n1001,2021\r\nnope,2020\r\n", "movie")).toEqual([
      { id: 1001, year: 2020 },
      { id: 1006, year: null },
    ]);
    expect(parseListCsv("id,year\nOL7003W,2019\nOL55M,2018\nOL9A,2017\n", "book")).toEqual([{ id: 7003, year: 2019 }]);
  });

  it("asks Wikidata for winners of the list's award, with the right id, and only works for books", () => {
    const oscar = listQuery(listBySlug("oscar-best-picture")!);
    expect(oscar).toContain("wd:Q102427");
    expect(oscar).toContain("wdt:P4947");
    const booker = listQuery(listBySlug("booker")!);
    expect(booker).toContain("wdt:P648");
    expect(booker).toContain('REGEX(?id, "^OL[0-9]+W$")');
  });

  it("knows its lists and any TMDb collection", () => {
    expect(new Set(LISTS.map((l) => l.slug)).size).toBe(LISTS.length);
    expect(listBySlug(collectionSlug(9100))?.source).toEqual({ kind: "collection", id: 9100 });
    expect(listBySlug("imdb-top-250")).toBeNull();
  });
});
