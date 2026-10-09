// A tiny fake TMDb for end-to-end tests: fixed films, so decks are deterministic
// and CI never depends on the real TMDb. Started by playwright.config.ts.
import http from "node:http";

const PORT = Number(process.env.MOCK_TMDB_PORT || 3199);

const THRILLER = [53, 80];
function film(id, title, language, extra = {}) {
  return {
    id,
    title,
    original_title: title,
    original_language: language,
    release_date: "2015-06-01",
    genre_ids: THRILLER,
    overview: `${title} is a tense film used by the MoodReel end-to-end tests.`,
    poster_path: null,
    backdrop_path: null,
    vote_average: 7.6,
    vote_count: language === "en" ? 2500 : 300,
    popularity: 20,
    ...extra,
  };
}

const FILMS = [
  ...Array.from({ length: 20 }, (_, i) => film(1000 + i, `English Thriller ${i + 1}`, "en")),
  ...Array.from({ length: 5 }, (_, i) => film(2000 + i, `Tamil Crime ${i + 1}`, "ta")),
  ...Array.from({ length: 5 }, (_, i) => film(3000 + i, `Malayalam Mystery ${i + 1}`, "ml", { genre_ids: [9648, 18] })),
  ...Array.from({ length: 5 }, (_, i) => film(4000 + i, `Hindi Thriller ${i + 1}`, "hi")),
  // Must never be dealt: a Hindi romance that isn't acclaimed fails your language rule.
  film(4999, "Hindi Ordinary Romance", "hi", { genre_ids: [10749, 18], vote_average: 6.4 }),
];

function json(res, body, status = 200) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

http
  .createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/3/discover/movie") {
      const lang = url.searchParams.get("with_original_language");
      const page = Number(url.searchParams.get("page") || 1);
      const results = page === 1 ? FILMS.filter((f) => f.original_language === lang) : [];
      return json(res, { page, results, total_pages: 1, total_results: results.length });
    }
    const m = url.pathname.match(/^\/3\/movie\/(\d+)$/);
    if (m) {
      const f = FILMS.find((x) => x.id === Number(m[1]));
      if (!f) return json(res, { status_message: "Not found" }, 404);
      return json(res, {
        ...f,
        genres: f.genre_ids.map((id) => ({ id, name: String(id) })),
        runtime: 118,
        tagline: null,
        credits: { cast: [{ name: "A. Actor" }], crew: [{ name: "D. Director", job: "Director" }] },
        videos: { results: [] },
        "watch/providers": {
          results: { IN: { link: `https://www.themoviedb.org/movie/${f.id}/watch?locale=IN`, flatrate: f.id % 2 ? [{ provider_id: 8, provider_name: "Netflix" }] : [] } },
        },
      });
    }
    json(res, { status_message: "Unknown path" }, 404);
  })
  .listen(PORT, () => console.log(`mock TMDb on ${PORT}`));
