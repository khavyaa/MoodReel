import "server-only";
import { and, desc, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { bookSignals, nytSync, syncRuns } from "@/lib/db/schema";
import { bookByIsbn } from "./openlibrary";

/*
 * New York Times bestseller lists, synced into the database once a day by a
 * Vercel cron (app/api/cron/nyt). Decks only ever read the database, so they
 * never wait on NYT, and without a key (or with NYT down) books still work on
 * Open Library alone.
 *
 * The NYT Books API is free with a key and rate-limited, so each run fetches
 * this week plus a few past weeks (spaced out) until about two years are in.
 */

const NYT_BASE = process.env.NYT_BASE_URL || "https://api.nytimes.com/svc/books/v3";

/** Adult lists only: no children's, young adult, advice or graphic lists. */
export const ADULT_LISTS = new Set([
  "combined-print-and-e-book-fiction",
  "hardcover-fiction",
  "trade-fiction-paperback",
  "paperback-trade-fiction",
  "combined-print-and-e-book-nonfiction",
  "hardcover-nonfiction",
  "paperback-nonfiction",
]);

/** How far back the backfill goes, and how many past weeks one run fetches. */
export const BACKFILL_WEEKS = 104;
const WEEKS_PER_RUN = 4;
/** NYT allows only a few calls a minute: wait this long between them. */
const GAP_MS = process.env.NYT_BASE_URL ? 0 : 13_000;
const MATCHES_PER_RUN = 40;

export function nytConfigured() {
  return Boolean(process.env.NYT_API_KEY);
}

type Overview = {
  results?: {
    published_date: string;
    lists: {
      list_name_encoded: string;
      books: { primary_isbn13?: string; title: string; author: string; rank: number; weeks_on_list: number }[];
    }[];
  };
};

async function fetchOverview(date?: string): Promise<Overview["results"] | null> {
  const url = new URL(`${NYT_BASE}/lists/full-overview.json`);
  url.searchParams.set("api-key", process.env.NYT_API_KEY ?? "");
  if (date) url.searchParams.set("published_date", date);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`NYT ${res.status}`);
  return ((await res.json()) as Overview).results ?? null;
}

/** Sundays going back from `from`, as YYYY-MM-DD: the dates NYT lists are published for. */
export function pastSundays(from: Date, weeks: number): string[] {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return Array.from({ length: weeks }, (_, i) => {
    const s = new Date(d);
    s.setUTCDate(d.getUTCDate() - 7 * i);
    return s.toISOString().slice(0, 10);
  });
}

type Entry = { isbn13: string; title: string; author: string; rank: number; weeks: number; list: string };

/** Pure: the adult-list entries of one week's overview. */
export function adultEntries(overview: NonNullable<Overview["results"]>): Entry[] {
  return overview.lists
    .filter((l) => ADULT_LISTS.has(l.list_name_encoded))
    .flatMap((l) =>
      l.books.flatMap((b) =>
        b.primary_isbn13
          ? [{ isbn13: b.primary_isbn13, title: b.title, author: b.author, rank: b.rank, weeks: b.weeks_on_list, list: l.list_name_encoded }]
          : [],
      ),
    );
}

async function store(publishedDate: string, entries: Entry[]) {
  const db = getDb();
  for (const e of entries) {
    await db
      .insert(bookSignals)
      .values({
        isbn13: e.isbn13,
        title: e.title,
        author: e.author,
        weeksOnList: e.weeks,
        bestRank: e.rank,
        lists: [e.list],
        lastSeen: publishedDate,
      })
      .onConflictDoUpdate({
        target: bookSignals.isbn13,
        set: {
          weeksOnList: sql`greatest(${bookSignals.weeksOnList}, ${e.weeks})`,
          bestRank: sql`least(${bookSignals.bestRank}, ${e.rank})`,
          lists: sql`(select array_agg(distinct x) from unnest(${bookSignals.lists} || array[${e.list}]::text[]) as x)`,
          lastSeen: sql`greatest(${bookSignals.lastSeen}, ${publishedDate})`,
          updatedAt: new Date(),
        },
      });
  }
  await db.insert(nytSync).values({ publishedDate }).onConflictDoNothing();
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type SyncReport = { skipped?: string; weeks: string[]; entries: number; matched: number; errors: string[] };

/** One cron run, with its report saved so Settings can show how the last run went. */
export async function syncNyt(now = new Date()): Promise<SyncReport> {
  let report: SyncReport;
  try {
    report = await runSync(now);
  } catch (error) {
    report = { weeks: [], entries: 0, matched: 0, errors: [error instanceof Error ? error.message : String(error)] };
  }
  await getDb()
    .insert(syncRuns)
    .values({ kind: "nyt", report })
    .catch(() => undefined);
  return report;
}

/** This week, a few unsynced past weeks, then match some ISBNs to Open Library works. */
async function runSync(now: Date): Promise<SyncReport> {
  const report: SyncReport = { weeks: [], entries: 0, matched: 0, errors: [] };
  if (!nytConfigured()) return { ...report, skipped: "NYT_API_KEY is not set" };
  const db = getDb();

  const done = new Set((await db.select({ d: nytSync.publishedDate }).from(nytSync)).map((r) => r.d));
  const todo = [undefined, ...pastSundays(now, BACKFILL_WEEKS).filter((d) => !done.has(d)).slice(0, WEEKS_PER_RUN)];

  for (const [i, date] of todo.entries()) {
    if (i > 0) await pause(GAP_MS);
    try {
      const overview = await fetchOverview(date);
      if (!overview) continue;
      const entries = adultEntries(overview);
      await store(overview.published_date, entries);
      // Mark the week asked for too, in case NYT answered with a neighbouring week's list.
      if (date && date !== overview.published_date) await getDb().insert(nytSync).values({ publishedDate: date }).onConflictDoNothing();
      report.weeks.push(overview.published_date);
      report.entries += entries.length;
    } catch (error) {
      report.errors.push(`${date ?? "current"}: ${error instanceof Error ? error.message : error}`);
    }
  }

  const unmatched = await db
    .select({ isbn13: bookSignals.isbn13 })
    .from(bookSignals)
    .where(eq(bookSignals.matchTried, false))
    .orderBy(desc(bookSignals.weeksOnList))
    .limit(MATCHES_PER_RUN);
  for (const { isbn13 } of unmatched) {
    const book = await bookByIsbn(isbn13).catch(() => null);
    await db
      .update(bookSignals)
      .set({ workId: book?.id ?? null, matchTried: true, updatedAt: new Date() })
      .where(eq(bookSignals.isbn13, isbn13));
    if (book) report.matched++;
  }
  return report;
}

/** Weeks on the NYT lists per Open Library work, for the works asked about. */
export async function nytWeeksByWork(workIds: number[]): Promise<Map<number, number>> {
  if (!workIds.length) return new Map();
  const rows = await getDb()
    .select({ workId: bookSignals.workId, weeks: sql<number>`max(${bookSignals.weeksOnList})` })
    .from(bookSignals)
    .where(inArray(bookSignals.workId, workIds))
    .groupBy(bookSignals.workId);
  return new Map(rows.map((r) => [r.workId!, Number(r.weeks)]));
}

/** Bestsellers that lasted, as Open Library works: the pool that brings in recent books with few ratings. */
export async function nytPoolWorks(minWeeks = 3, limit = 200): Promise<Map<number, number>> {
  const rows = await getDb()
    .select({ workId: bookSignals.workId, weeks: sql<number>`max(${bookSignals.weeksOnList})` })
    .from(bookSignals)
    .where(and(isNotNull(bookSignals.workId), gte(bookSignals.weeksOnList, minWeeks)))
    .groupBy(bookSignals.workId)
    .orderBy(sql`max(${bookSignals.weeksOnList}) desc`)
    .limit(limit);
  return new Map(rows.map((r) => [r.workId!, Number(r.weeks)]));
}

export type NytStatus = {
  configured: boolean;
  lastRun: { at: Date; report: SyncReport } | null;
  weeksSynced: number;
  latestList: string | null;
  books: number;
  matched: number;
};

/** What Settings shows about the bestseller sync. */
export async function nytStatus(): Promise<NytStatus> {
  const db = getDb();
  const [last] = await db
    .select({ at: syncRuns.ranAt, report: syncRuns.report })
    .from(syncRuns)
    .where(eq(syncRuns.kind, "nyt"))
    .orderBy(desc(syncRuns.ranAt))
    .limit(1);
  const [weeks] = await db.select({ n: sql<number>`count(*)` }).from(nytSync);
  // The newest list actually seen, not just the newest date asked for.
  const [books] = await db
    .select({
      n: sql<number>`count(*)`,
      matched: sql<number>`count(${bookSignals.workId})`,
      latest: sql<string | null>`max(${bookSignals.lastSeen})`,
    })
    .from(bookSignals);
  return {
    configured: nytConfigured(),
    lastRun: last ? { at: last.at, report: last.report as unknown as SyncReport } : null,
    weeksSynced: Number(weeks?.n ?? 0),
    latestList: books?.latest ?? null,
    books: Number(books?.n ?? 0),
    matched: Number(books?.matched ?? 0),
  };
}
