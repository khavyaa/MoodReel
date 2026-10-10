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
    // Long enough to be clipped on the card, so "More" shows.
    overview: `${title} is a tense film used by the MoodReel end-to-end tests. ${"A detective follows a trail of small lies through a city that would rather forget them, and every answer opens a worse question. ".repeat(4)}The end.`,
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

// Series: crime dramas in English and Hindi, plus two that must never be dealt.
function show(id, name, language, extra = {}) {
  return {
    id,
    name,
    original_name: name,
    original_language: language,
    first_air_date: "2019-03-01",
    genre_ids: [80, 18],
    overview: `${name} is a tense series used by the MoodReel end-to-end tests.`,
    poster_path: null,
    backdrop_path: null,
    vote_average: 8.1,
    vote_count: language === "en" ? 1800 : 90,
    popularity: 30,
    ...extra,
  };
}

const SHOWS = [
  ...Array.from({ length: 16 }, (_, i) => show(5000 + i, `English Series ${i + 1}`, "en")),
  ...Array.from({ length: 6 }, (_, i) => show(6000 + i, `Hindi Series ${i + 1}`, "hi")),
  // Never dealt: animation (your rule) and a 300-episode Hindi daily soap filed as drama.
  show(5900, "Animated Crime Show", "en", { genre_ids: [16, 80] }),
  // Rated highest of all the Hindi shows, so only the daily-soap rule keeps it out.
  show(6900, "Hindi Daily Saga", "hi", { genre_ids: [18, 80], vote_average: 9.1, vote_count: 140 }),
];

function showDetails(f) {
  const soap = f.id === 6900;
  const seasons = soap ? 12 : f.id % 3 === 0 ? 1 : 3;
  return {
    ...f,
    genres: f.genre_ids.map((id) => ({ id, name: String(id) })),
    number_of_seasons: seasons,
    number_of_episodes: soap ? 300 : seasons * 8,
    episode_run_time: [45],
    status: f.id % 2 ? "Returning Series" : "Ended",
    type: seasons === 1 ? "Miniseries" : "Scripted",
    // The soap's first season is short, so only its 300-episode total gives it away.
    seasons: Array.from({ length: seasons }, (_, i) => ({ season_number: i + 1, episode_count: soap && i > 0 ? 26 : 8 })),
    created_by: [{ name: "C. Creator" }],
    credits: { cast: [{ name: "A. Actor" }] },
    videos: { results: [] },
    "watch/providers": {
      results: { IN: { flatrate: f.id % 2 ? [{ provider_id: 119, provider_name: "Amazon Prime Video" }] : [] } },
    },
  };
}

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
    if (url.pathname === "/3/discover/tv") {
      const lang = url.searchParams.get("with_original_language");
      const page = Number(url.searchParams.get("page") || 1);
      const results = page === 1 ? SHOWS.filter((f) => f.original_language === lang) : [];
      return json(res, { page, results, total_pages: 1, total_results: results.length });
    }
    const t = url.pathname.match(/^\/3\/tv\/(\d+)$/);
    if (t) {
      const f = SHOWS.find((x) => x.id === Number(t[1]));
      if (!f) return json(res, { status_message: "Not found" }, 404);
      return json(res, showDetails(f));
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
          results: {
            IN: {
              flatrate: f.id % 2
                ? [{ provider_id: 8, provider_name: "Netflix" }, { provider_id: 232, provider_name: "Zee5" }]
                : [],
            },
          },
        },
      });
    }
    if (url.pathname === "/3/watch/providers/movie") {
      const p = (provider_id, provider_name, priority) => ({
        provider_id, provider_name, logo_path: null, display_priorities: { IN: priority },
      });
      return json(res, {
        results: [
          p(8, "Netflix", 0), p(119, "Amazon Prime Video", 1), p(350, "Apple TV", 2), p(2336, "JioHotstar", 3),
          p(2, "Apple TV Store", 5), p(232, "Zee5", 7), p(2243, "Apple TV Amazon Channel", 65),
        ],
      });
    }
    json(res, { status_message: "Unknown path" }, 404);
  })
  .listen(PORT, () => console.log(`mock TMDb on ${PORT}`));
