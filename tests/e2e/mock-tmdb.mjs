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

// TMDb's "based on novel or book" keyword (818): these films come back for it.
const BASED_ON_BOOK = new Set([1015, 1016, 1017, 1018, 1019, 2004]);
// A film whose credits name the novel's author ("Novel" job), for the credits fallback.
const NOVEL_BY = { 1018: "Author 9" };

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
    created_by: [{ id: 800 + (f.id % 3), name: `Creator ${(f.id % 3) + 1}` }],
    credits: { cast: [{ id: 850, name: "Series Lead", order: 0 }] },
    videos: { results: [] },
    "watch/providers": {
      results: { IN: { flatrate: f.id % 2 ? [{ provider_id: 119, provider_name: "Amazon Prime Video" }] : [] } },
    },
  };
}

// Books (Open Library under /ol) and NYT bestseller lists (under /nyt).
function book(n, title, author, extra = {}) {
  return {
    key: `/works/OL${n}W`,
    title,
    author_name: [author],
    author_key: [`OL${9000 + n}A`],
    first_publish_year: 2018,
    number_of_pages_median: 340,
    ratings_average: 4.3,
    ratings_count: 120,
    already_read_count: 300,
    subject: ["Fiction", "Thriller", "Suspense", "Fiction, thrillers, psychological"],
    cover_i: null,
    isbn: [`97800000${n}`],
    ...extra,
  };
}

const BOOKS = [
  ...Array.from({ length: 12 }, (_, i) => book(7000 + i, `Thriller Book ${i + 1}`, `Author ${i + 1}`)),
  // Only gets in through the NYT lists: too few Open Library ratings on its own.
  book(7100, "Bestseller Only", "Nyt Author", { ratings_count: 2, ratings_average: 4.0, isbn: ["9780000007100"] }),
  // Never dealt: young adult, romance, a graphic novel filed by its comics class code, children's.
  book(7900, "Teen Thriller", "Ya Author", { subject: ["Thriller", "Young adult fiction"] }),
  book(7901, "Romantic Suspense", "Ro Author", { subject: ["Suspense", "Romance", "Fiction"] }),
  book(7902, "Dark Knight Panels", "Gn Author", { subject: ["Thriller", "Suspense", "741.5/973"] }),
  book(7903, "Kids Mystery", "Kid Author", { subject: ["Mystery", "Juvenile fiction"] }),
];

function olSearch(url) {
  const q = url.searchParams.get("q") || "";
  // A film's book by title and author (the credits fallback): matched on the author here.
  const byName = q.match(/author:"([^"]+)"/);
  if (byName) return BOOKS.filter((b) => b.author_name[0] === byName[1]);
  const byAuthor = q.match(/author_key:(OL\d+A)/);
  if (byAuthor) return BOOKS.filter((b) => b.author_key?.includes(byAuthor[1]));
  const keys = [...q.matchAll(/key:"\/works\/(OL\d+W)"/g)].map((m) => `/works/${m[1]}`);
  if (keys.length) return BOOKS.filter((b) => keys.includes(b.key));
  const isbn = q.match(/isbn:(\d+)/);
  if (isbn) return BOOKS.filter((b) => b.isbn.includes(isbn[1]));
  const pages = q.match(/number_of_pages_median:\[(\d+) TO (\d+)\]/);
  const minRatings = Number(q.match(/ratings_count:\[(\d+) TO/)?.[1] ?? 0);
  return BOOKS.filter(
    (b) =>
      (!pages || (b.number_of_pages_median >= Number(pages[1]) && b.number_of_pages_median <= Number(pages[2]))) &&
      b.ratings_count >= minRatings,
  );
}

const NYT_OVERVIEW = {
  results: {
    published_date: "2026-10-04",
    lists: [
      {
        list_name_encoded: "hardcover-fiction",
        books: [{ primary_isbn13: "9780000007100", title: "BESTSELLER ONLY", author: "Nyt Author", rank: 3, weeks_on_list: 12 }],
      },
      // Not an adult list: ignored.
      {
        list_name_encoded: "young-adult-hardcover",
        books: [{ primary_isbn13: "9780000007900", title: "TEEN THRILLER", author: "Ya Author", rank: 1, weeks_on_list: 30 }],
      },
    ],
  },
};

// People: five directors share the English thrillers, so one director has several films.
const DIRECTORS = ["Ava Director", "Ben Director", "Cara Director", "Dev Director", "Eli Director"];
const directorOf = (f) => ({ id: 700 + (f.id % 5), name: DIRECTORS[f.id % 5] });
function filmCredits(f) {
  const d = directorOf(f);
  return {
    crew: [
      { id: d.id, name: d.name, job: "Director", department: "Directing" },
      { id: 760, name: "Wren Writer", job: "Screenplay", department: "Writing" },
      ...(NOVEL_BY[f.id] ? [{ id: 790, name: NOVEL_BY[f.id], job: "Novel", department: "Writing" }] : []),
    ],
    cast: [
      { id: 780, name: "Lead Actor", order: 0 },
      { id: 781 + (f.id % 2), name: f.id % 2 ? "Second Odd" : "Second Even", order: 1 },
    ],
  };
}

function personResponse(id) {
  const directed = FILMS.filter((f) => directorOf(f).id === id);
  const starred = id === 780 ? FILMS : [];
  const name =
    id >= 700 && id < 705 ? DIRECTORS[id - 700] : id === 780 ? "Lead Actor" : id === 760 ? "Wren Writer" : null;
  if (!name) return null;
  return {
    id,
    name,
    known_for_department: id < 705 ? "Directing" : id === 760 ? "Writing" : "Acting",
    movie_credits: {
      crew: directed.map((f) => ({ ...f, job: "Director", department: "Directing" })),
      cast: starred.map((f) => ({ ...f, order: 0 })),
    },
    tv_credits: { cast: [], crew: [] },
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
      const bookOnly = url.searchParams.get("with_keywords") === "818";
      const results =
        page === 1 ? FILMS.filter((f) => f.original_language === lang && (!bookOnly || BASED_ON_BOOK.has(f.id))) : [];
      return json(res, { page, results, total_pages: 1, total_results: results.length });
    }
    const person = url.pathname.match(/^\/3\/person\/(\d+)$/);
    if (person) {
      const p = personResponse(Number(person[1]));
      return p ? json(res, p) : json(res, { status_message: "Not found" }, 404);
    }
    if (url.pathname === "/3/search/person") {
      const q = (url.searchParams.get("query") || "").toLowerCase();
      const results = [700, 701, 702, 703, 704, 760, 780]
        .map((id) => personResponse(id))
        .filter((p) => p.name.toLowerCase().includes(q))
        .map((p) => ({ id: p.id, name: p.name, known_for_department: p.known_for_department, known_for: [] }));
      return json(res, { results });
    }
    const author = url.pathname.match(/^\/ol\/authors\/OL(\d+)A\.json$/);
    if (author) {
      const b = BOOKS.find((x) => x.author_key?.[0] === `OL${author[1]}A`);
      return b ? json(res, { name: b.author_name[0] }) : json(res, { error: "notfound" }, 404);
    }
    if (url.pathname === "/ol/search/authors.json") {
      const q = (url.searchParams.get("q") || "").toLowerCase();
      const docs = BOOKS.filter((b) => b.author_name[0].toLowerCase().includes(q)).map((b) => ({
        key: b.author_key[0],
        name: b.author_name[0],
        top_work: b.title,
      }));
      return json(res, { docs });
    }
    if (url.pathname === "/ol/search.json") {
      const docs = olSearch(url);
      return json(res, { numFound: docs.length, docs });
    }
    const w = url.pathname.match(/^\/ol\/works\/(OL\d+W)\.json$/);
    if (w) {
      const b = BOOKS.find((x) => x.key === `/works/${w[1]}`);
      if (!b) return json(res, { error: "notfound" }, 404);
      return json(res, { description: `${b.title} is a tense book used by the MoodReel end-to-end tests. The detective and the killer play a long game in the city.` });
    }
    // Wikidata's query service: films (P4947) and series (P4983) based on books, as CSV.
    if (url.pathname === "/wikidata/sparql") {
      const q = url.searchParams.get("query") || "";
      res.writeHead(200, { "content-type": "text/csv" });
      return res.end(q.includes("P4947") ? "tmdb,ol\r\n1011,OL7004W\r\n1012,OL5000M\r\n" : "tmdb,ol\r\n5003,OL7006W\r\n");
    }
    // An edition, for Wikidata links that name one instead of the work.
    if (url.pathname === "/ol/books/OL5000M.json") return json(res, { works: [{ key: "/works/OL7005W" }] });
    if (url.pathname === "/nyt/lists/full-overview.json") {
      if (!url.searchParams.get("api-key")) return json(res, { fault: "no key" }, 401);
      return json(res, NYT_OVERVIEW);
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
        credits: filmCredits(f),
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
