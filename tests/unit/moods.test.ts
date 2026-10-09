import { describe, expect, it } from "vitest";
import { MEDIA, MEDIA_SLUGS, MOODS, isMediaSlug } from "@/lib/moods";

describe("media and moods", () => {
  it("maps each URL slug to a database media value", () => {
    expect(MEDIA_SLUGS).toEqual(["movies", "series", "books"]);
    expect(MEDIA_SLUGS.map((s) => MEDIA[s].media)).toEqual(["movie", "series", "book"]);
  });

  it("only offers moods that exist, with three time options each", () => {
    for (const slug of MEDIA_SLUGS) {
      for (const mood of MEDIA[slug].moods) expect(MOODS[mood]).toBeDefined();
      expect(MEDIA[slug].time).toHaveLength(3);
    }
  });

  it("keeps Romantic to movies, as agreed", () => {
    expect(MEDIA.movies.moods).toContain("romantic");
    expect(MEDIA.series.moods).not.toContain("romantic");
    expect(MEDIA.books.moods).not.toContain("romantic");
  });

  it("recognises slugs", () => {
    expect(isMediaSlug("series")).toBe(true);
    expect(isMediaSlug("movie")).toBe(false);
    expect(isMediaSlug("settings")).toBe(false);
  });
});
