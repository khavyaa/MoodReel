import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { parseIdList, parseLanguages } from "@/lib/api";

describe("parseLanguages", () => {
  it("defaults to all three supported languages", () => {
    expect(parseLanguages(null)).toEqual(["en", "hi", "ta"]);
  });

  it("keeps only supported codes and dedupes", () => {
    expect(parseLanguages("ta, en ,ta,fr")).toEqual(["ta", "en"]);
  });

  it("falls back to all languages when nothing valid is supplied", () => {
    expect(parseLanguages("fr,de")).toEqual(["en", "hi", "ta"]);
  });
});

describe("parseIdList", () => {
  it("keeps positive integers only", () => {
    expect(parseIdList("12, 0, -4, abc, 88")).toEqual([12, 88]);
  });

  it("returns an empty list for missing input", () => {
    expect(parseIdList(null)).toEqual([]);
  });
});

describe("GET /api/movies/search", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  function stubTmdb(results: unknown[]) {
    const fetchMock = vi.fn(async (url: string | URL) => {
      const href = String(url);
      const body = href.includes("/genre/movie/list")
        ? { genres: [{ id: 35, name: "Comedy" }] }
        : { results };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  const tmdbMovie = (id: number, language: string) => ({
    id,
    title: `Movie ${id}`,
    original_title: `Movie ${id}`,
    overview: "An overview",
    poster_path: "/p.jpg",
    backdrop_path: null,
    original_language: language,
    genre_ids: [35],
    vote_average: 7.1,
    vote_count: 400,
    popularity: 22,
    release_date: "2019-04-01",
  });

  it("returns normalised cards filtered to the requested languages", async () => {
    vi.stubEnv("TMDB_ACCESS_TOKEN", "test-token");
    stubTmdb([tmdbMovie(1, "en"), tmdbMovie(2, "fr"), tmdbMovie(3, "ta")]);

    const { GET } = await import("@/app/api/movies/search/route");
    const request = new NextRequest("http://localhost/api/movies/search?q=test&languages=en,ta");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.movies.map((m: { id: number }) => m.id)).toEqual([1, 3]);
    expect(body.movies[0]).toMatchObject({ year: 2019, genres: ["Comedy"], language: "en" });
  });

  it("rejects an empty query", async () => {
    vi.stubEnv("TMDB_ACCESS_TOKEN", "test-token");
    const { GET } = await import("@/app/api/movies/search/route");
    const response = await GET(new NextRequest("http://localhost/api/movies/search?q="));
    expect(response.status).toBe(400);
  });

  it("reports 503 when the TMDb token is missing", async () => {
    vi.stubEnv("TMDB_ACCESS_TOKEN", "");
    const { GET } = await import("@/app/api/movies/search/route");
    const response = await GET(new NextRequest("http://localhost/api/movies/search?q=heat"));
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe("tmdb_not_configured");
  });
});
