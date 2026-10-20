import "server-only";
import { nytWeeksFromSubjects, type BookCandidate } from "./rules";

/*
 * Open Library: free, no key. It asks API users to send a User-Agent naming the
 * app, and to go easy, so every response is cached by Next for hours.
 * Overridable only so end-to-end tests can point at a fixed fake.
 */

const OL_BASE = process.env.OPEN_LIBRARY_BASE_URL || "https://openlibrary.org";
const HEADERS = { "User-Agent": "MoodReel/1.0 (personal book picker)", Accept: "application/json" };
const MAX_ATTEMPTS = 3;
const HOURS = 60 * 60;

export class OpenLibraryError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "OpenLibraryError";
  }
}

async function ol<T>(path: string, params: Record<string, string | number | undefined>, revalidate: number): Promise<T> {
  const url = new URL(`${OL_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, { headers: HEADERS, next: { revalidate } });
      if (res.ok) return (await res.json()) as T;
      if (res.status < 500 && res.status !== 429) throw new OpenLibraryError(`Open Library ${res.status}`, res.status);
      lastError = new OpenLibraryError(`Open Library ${res.status}`, res.status);
    } catch (error) {
      if (error instanceof OpenLibraryError && error.status < 500 && error.status !== 429) throw error;
      lastError = error;
    }
    await new Promise((r) => setTimeout(r, 300 * attempt + Math.random() * 200));
  }
  throw lastError instanceof Error ? lastError : new OpenLibraryError("Open Library unreachable", 0);
}

/** "/works/OL27448W" → 27448. Stored as the title's external id (source "openlibrary"). */
export function workNumber(key: string): number | null {
  const m = key.match(/OL(\d+)W/);
  return m ? Number(m[1]) : null;
}
export const workKey = (n: number) => `OL${n}W`;

/** Cover by Open Library cover id, at "S", "M" or "L". The poster component builds this from `ol:<id>`. */
export const coverPath = (coverId: number | null | undefined) => (coverId ? `ol:${coverId}` : null);

const FIELDS = [
  "key",
  "title",
  "author_name",
  "author_key",
  "first_publish_year",
  "number_of_pages_median",
  "ratings_average",
  "ratings_count",
  "already_read_count",
  "subject",
  "cover_i",
  "editions",
  "editions.title",
  "editions.language",
].join(",");

type OlDoc = {
  key: string;
  title: string;
  author_name?: string[];
  author_key?: string[];
  first_publish_year?: number;
  number_of_pages_median?: number;
  ratings_average?: number;
  ratings_count?: number;
  already_read_count?: number;
  subject?: string[];
  cover_i?: number;
  editions?: { docs?: { title?: string; language?: string[] }[] };
};

const ENGLISH_WORDS = new Set(["the", "a", "an", "of", "and", "in", "to", "is", "his", "her", "that", "with", "for", "on", "was", "who", "called"]);
const englishWordCount = (text: string) =>
  text
    .toLowerCase()
    .split(/[^a-z']+/)
    .filter((w) => ENGLISH_WORDS.has(w)).length;

/** Fixes the shapes edition titles come in: "Queen's Gambit,the", "The Trial (Penguin Books. no. 907.)", "a man called ove". */
export function tidyTitle(raw: string): string {
  let t = raw.replace(/\s*\([^)]*\)\s*$/, "").replace(/\s*\[[^\]]*\]\s*$/, "").trim();
  const trailing = t.match(/^(.*?),\s*(the|a|an)$/i);
  if (trailing) t = `${trailing[2][0].toUpperCase()}${trailing[2].slice(1).toLowerCase()} ${trailing[1]}`;
  // All lower case after the first letter: title-case it, keeping small words small.
  if (t.length > 3 && t.slice(1) === t.slice(1).toLowerCase() && /[a-z]/.test(t)) {
    const small = new Set(["a", "an", "the", "of", "and", "in", "on", "to", "for", "at", "by", "or"]);
    t = t
      .split(" ")
      .map((w, i) => (i > 0 && small.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
      .join(" ");
  }
  return t;
}

/**
 * The work's title, unless it's filed under another language's title (En man
 * som heter Ove, Het Achterhuis): then its English edition's title. Edition
 * titles are messier, so they're only used when the work title clearly isn't
 * English and the edition's clearly is.
 */
function englishTitle(doc: OlDoc): string {
  const edition = doc.editions?.docs?.find((e) => e.language?.includes("eng") && e.title)?.title;
  const work = tidyTitle(doc.title);
  if (!edition) return work;
  const english = tidyTitle(edition);
  // A lone "a" doesn't make a title English (Ensaio Sobre a Cegueira).
  const workLooksEnglish = englishWordCount(doc.title.replace(/\ba\b/gi, "")) > 0;
  return !workLooksEnglish && english.toLowerCase() !== work.toLowerCase() ? english : work;
}

/** Box sets, omnibuses and "complete works" aren't one book to read next. */
const OMNIBUS =
  /^works$|\bbox(ed)?\s*set\b|\bomnibus\b|\bebundle\b|\bcollection set\b|\btitle set\b|\b\d+\s+(?:book|title|novel|volume)s?\s+set\b|\bbooks?\s+\d+\s*[-–&]\s*\d+\b/i;
export const isOmnibus = (title: string, pages: number | null) => OMNIBUS.test(title) || (pages ?? 0) > 1100;

/** Descriptions come in whatever language a librarian wrote them in; keep English ones only. */
export function looksEnglish(text: string): boolean {
  const words = text.split(/\s+/).slice(0, 60);
  return words.length < 8 || englishWordCount(words.join(" ")) >= 3;
}

/** Latin-script author names only: a name in another script means no English edition data worth showing. */
const latinName = (name: string) => /^[\p{Script=Latin}\p{P}\p{Zs}\d]+$/u.test(name);

export function toBookCandidate(doc: OlDoc, nytWeeks = 0): BookCandidate | null {
  const id = workNumber(doc.key);
  if (!id) return null;
  // A first author in another script means Open Library's English data for it is thin (and the
  // next name is often the translator), so leave it out.
  if (doc.author_name?.length && !latinName(doc.author_name[0])) return null;
  const authors = (doc.author_name ?? []).filter(latinName);
  const title = englishTitle(doc);
  if (isOmnibus(title, doc.number_of_pages_median ?? null)) return null;
  const subjects = doc.subject ?? [];
  return {
    id,
    title,
    originalTitle: doc.title,
    language: "en",
    year: doc.first_publish_year ?? null,
    releaseDate: doc.first_publish_year ? `${doc.first_publish_year}-01-01` : null,
    genreIds: [],
    overview: "",
    posterPath: coverPath(doc.cover_i),
    backdropPath: null,
    voteAverage: Math.round((doc.ratings_average ?? 0) * 100) / 100,
    voteCount: doc.ratings_count ?? 0,
    popularity: doc.already_read_count ?? 0,
    onMyServices: false,
    authors: authors.slice(0, 3),
    authorIds: (doc.author_key ?? [])
      .map((k, i) => ({ id: Number(k.match(/OL(\d+)A/)?.[1] ?? 0), name: doc.author_name?.[i] ?? "" }))
      .filter((a) => a.id && a.name && latinName(a.name))
      .slice(0, 3),
    pages: doc.number_of_pages_median ?? null,
    subjects,
    ratingsCount: doc.ratings_count ?? 0,
    readCount: doc.already_read_count ?? 0,
    nytWeeks: Math.max(nytWeeks, nytWeeksFromSubjects(subjects)),
    englishEdition: doc.editions?.docs?.length ? doc.editions.docs.some((e) => e.language?.includes("eng")) : undefined,
  };
}

export type BookQuery = {
  subjects: string[];
  never: string;
  pages: [number, number];
  minRatings: number;
  sort: "rating" | "readinglog" | "new";
  page: number;
};

/** Exported for tests: the exact Open Library search for one pool. */
export function bookSearchParams(q: BookQuery) {
  const subjects = q.subjects.map((s) => `subject:"${s}"`).join(" OR ");
  return {
    q: `(${subjects}) language:eng ratings_count:[${q.minRatings} TO *] number_of_pages_median:[${q.pages[0]} TO ${q.pages[1]}] ${q.never}`,
    fields: FIELDS,
    sort: q.sort,
    lang: "en",
    limit: 60,
    page: q.page,
  };
}

export async function searchBooks(q: BookQuery): Promise<BookCandidate[]> {
  const data = await ol<{ docs: OlDoc[] }>("/search.json", bookSearchParams(q), 12 * HOURS);
  return data.docs.flatMap((d) => toBookCandidate(d) ?? []);
}

/** Works by Open Library number, in one search, for the NYT pool and the library pages. */
export async function booksByWork(ids: number[]): Promise<Map<number, BookCandidate>> {
  const found = new Map<number, BookCandidate>();
  for (let i = 0; i < ids.length; i += 40) {
    const chunk = ids.slice(i, i + 40);
    const data = await ol<{ docs: OlDoc[] }>(
      "/search.json",
      { q: chunk.map((id) => `key:"/works/${workKey(id)}"`).join(" OR "), fields: FIELDS, lang: "en", limit: chunk.length },
      12 * HOURS,
    );
    for (const d of data.docs) {
      const book = toBookCandidate(d);
      if (book) found.set(book.id, book);
    }
  }
  return found;
}

/** An ISBN to its work, for matching NYT bestsellers. Null when Open Library doesn't know it. */
export async function bookByIsbn(isbn: string): Promise<BookCandidate | null> {
  const data = await ol<{ docs: OlDoc[] }>("/search.json", { q: `isbn:${isbn}`, fields: FIELDS, lang: "en", limit: 1 }, 7 * 24 * HOURS);
  return data.docs[0] ? toBookCandidate(data.docs[0]) : null;
}

/** An edition (OL…M) to its work number, for Wikidata links that name an edition. */
export async function workOfEdition(edition: string): Promise<number | null> {
  const data = await ol<{ works?: { key: string }[] }>(`/books/${edition}.json`, {}, 30 * 24 * HOURS).catch(() => null);
  const key = data?.works?.[0]?.key;
  return key ? workNumber(key) : null;
}

/** A book by title and author, for a film whose credits say "Novel by …". Null unless Open Library finds it. */
export async function findWork(title: string, author: string): Promise<BookCandidate | null> {
  const clean = (s: string) => s.replace(/["\\]/g, "").trim();
  const data = await ol<{ docs: OlDoc[] }>(
    "/search.json",
    { q: `title:"${clean(title)}" author:"${clean(author)}"`, fields: FIELDS, sort: "readinglog", lang: "en", limit: 3 },
    7 * 24 * HOURS,
  );
  for (const d of data.docs) {
    const book = toBookCandidate(d);
    if (book) return book;
  }
  return null;
}

/** Which of these work numbers Open Library's search knows; a merged (old) work number isn't among them. */
export async function existingWorks(ids: number[]): Promise<Set<number>> {
  const found = new Set<number>();
  const chunks = Array.from({ length: Math.ceil(ids.length / 40) }, (_, i) => ids.slice(i * 40, i * 40 + 40));
  for (let i = 0; i < chunks.length; i += 4) {
    const results = await Promise.all(
      chunks.slice(i, i + 4).map((chunk) =>
        ol<{ docs: { key: string }[] }>(
          "/search.json",
          { q: chunk.map((id) => `key:"/works/${workKey(id)}"`).join(" OR "), fields: "key", limit: chunk.length },
          24 * HOURS,
        ),
      ),
    );
    for (const r of results) for (const d of r.docs) found.add(workNumber(d.key) ?? 0);
  }
  return found;
}

/** Where a merged work now lives: its new number, or null when it isn't a redirect. */
export async function redirectOf(id: number): Promise<number | null> {
  const work = await ol<{ type?: { key?: string }; location?: string }>(`/works/${workKey(id)}.json`, {}, 30 * 24 * HOURS).catch(() => null);
  return work?.type?.key === "/type/redirect" && work.location ? workNumber(work.location) : null;
}

/** The work's description, which search results don't carry. */
export async function bookDescription(id: number): Promise<string> {
  try {
    const work = await ol<{ description?: string | { value?: string } }>(`/works/${workKey(id)}.json`, {}, 7 * 24 * HOURS);
    const raw = typeof work.description === "string" ? work.description : (work.description?.value ?? "");
    // Descriptions often carry a source note or a "----" block of links; keep the prose.
    const text = raw.split(/\r?\n-{3,}|\(\[source\]|\[source\]/)[0].replace(/[*_]{2,}/g, "").replace(/\s+/g, " ").trim().slice(0, 1200);
    return looksEnglish(text) ? text : "";
  } catch {
    return "";
  }
}


/* ---------------------------------------------------------------- authors */

/* ---------------------------------------------------------- bibliography */

/** Sets, adapted or abridged versions, and numbered textbook editions: not a book of theirs to read next. */
const NOT_A_BOOK =
  /\btitle set\b|\b\d+\s+(?:title|book|novel|volume)s?\s+set\b|\[adaptation\]|\babridged\b|\b(?:\d+(?:st|nd|rd|th)|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|thirteenth|fourteenth|fifteenth|sixteenth)\s+edition\b/i;
/** Classroom readers and anthologies they only contributed to. */
const TEXTBOOK_SUBJECTS = ["study and teaching", "textbooks", "college readers", "collections"];

const titleKey = (title: string) =>
  title
    .toLowerCase()
    .replace(/^(the|a|an)\s+/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * An author's page from Open Library's raw list: drops sets, adaptations,
 * textbook editions, anthologies (three or more authors) and entries nobody
 * has read, rated or paged; keeps one of each title (the most read); and
 * blanks a first-published year from before the author was 12, which Open
 * Library sometimes gets from a stray old edition. Input most-read first.
 */
export function tidyBibliography(books: BookCandidate[], birthYear: number | null): BookCandidate[] {
  const seen = new Set<string>();
  return books.flatMap((b) => {
    if (NOT_A_BOOK.test(b.title) || NOT_A_BOOK.test(b.originalTitle)) return [];
    if (b.subjects.some((s) => TEXTBOOK_SUBJECTS.some((t) => s.toLowerCase().includes(t)))) return [];
    if (b.authors.length >= 3) return [];
    if (!b.readCount && !b.ratingsCount && !b.pages) return [];
    const key = titleKey(b.title);
    if (seen.has(key)) return [];
    seen.add(key);
    const tooEarly = birthYear !== null && b.year !== null && b.year < birthYear + 12;
    return [tooEarly ? { ...b, year: null, releaseDate: null } : b];
  });
}

/** "23 May 1958", "1958", "May 1958" → 1958. */
export function birthYearOf(date: string | undefined): number | null {
  const m = date?.match(/\b(1[5-9]\d\d|20\d\d)\b/);
  return m ? Number(m[1]) : null;
}

/** An author's name and best-known works (English, rated or read most first), tidied for their page. */
export async function authorWithBooks(id: number): Promise<{ name: string; books: BookCandidate[] } | null> {
  const key = `OL${id}A`;
  const [author, works] = await Promise.all([
    ol<{ name?: string; personal_name?: string; birth_date?: string }>(`/authors/${key}.json`, {}, 7 * 24 * HOURS).catch(() => null),
    ol<{ docs: OlDoc[] }>(
      "/search.json",
      { q: `author_key:${key} language:eng`, fields: FIELDS, sort: "readinglog", lang: "en", limit: 60 },
      12 * HOURS,
    ),
  ]);
  const name = author?.name ?? author?.personal_name;
  if (!name) return null;
  return { name, books: tidyBibliography(works.docs.flatMap((d) => toBookCandidate(d) ?? []), birthYearOf(author?.birth_date)) };
}

type OlAuthor = { key: string; name: string; top_work?: string; work_count?: number };

/**
 * Open Library often has the same author under several records (a stub with a
 * handful of works beside the real one): keep the one with the most works per name.
 */
export function dedupeAuthors(docs: OlAuthor[]): OlAuthor[] {
  const best = new Map<string, OlAuthor>();
  for (const a of docs) {
    const name = a.name.toLowerCase().replace(/\s+/g, " ").trim();
    const held = best.get(name);
    if (!held || (a.work_count ?? 0) > (held.work_count ?? 0)) best.set(name, a);
  }
  return docs.filter((a) => best.get(a.name.toLowerCase().replace(/\s+/g, " ").trim()) === a);
}

/** Authors matching a name, for "with someone in mind?". */
export async function searchAuthors(query: string): Promise<{ id: number; name: string; detail: string }[]> {
  const data = await ol<{ docs: OlAuthor[] }>("/search/authors.json", { q: query, limit: 12 }, HOURS);
  return dedupeAuthors(data.docs)
    .slice(0, 8)
    .flatMap((a) => {
      const id = Number(a.key.match(/OL(\d+)A/)?.[1] ?? 0);
      if (!id || !latinName(a.name)) return [];
      return [{ id, name: a.name, detail: a.top_work ? `author of ${a.top_work}` : "author" }];
    });
}
