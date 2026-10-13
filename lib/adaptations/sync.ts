import "server-only";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { adaptations, syncRuns } from "@/lib/db/schema";
import { existingWorks, redirectOf, workNumber, workOfEdition } from "@/lib/books/openlibrary";
import { parseWikidataCsv } from "./rules";

/*
 * Which films and series are based on which books, from Wikidata: anything
 * with a TMDb id (P4947 films, P4983 series) and "based on" (P144) a work that
 * has an Open Library id (P648). Synced weekly by the daily cron, because the
 * Wikidata Query Service is slow and rate-limits hard; decks only read the
 * database. Links are only added, never removed: a link found from a film's
 * credits stays even when Wikidata doesn't have it.
 *
 * Wikidata sometimes names an Open Library work that has since been merged
 * into another, so every day a batch of book ids is checked and moved to the
 * work they now redirect to; otherwise a book you read wouldn't find its film.
 */

const WDQS = process.env.WIKIDATA_SPARQL_URL || "https://query.wikidata.org/sparql";
const USER_AGENT = "MoodReel/1.0 (https://github.com/khavyaa/MoodReel; personal recommender)";
const PROPERTY = { movie: "P4947", series: "P4983" } as const;

/** Run weekly; after a failed run, try again the next day. */
const EVERY_DAYS = 6;
/** Editions are resolved to works one request each, so only this many per run. */
const EDITIONS_PER_RUN = 300;
/** Book ids checked for merged works per run, and how many of the missing ones are looked up. */
const CHECKS_PER_RUN = 1200;
const REDIRECTS_PER_RUN = 150;

export type AdaptationsReport = {
  /** Whether Wikidata was queried this run (weekly), or only merged works checked (daily). */
  wikidata: boolean;
  films: number;
  series: number;
  added: number;
  editions: number;
  checked: number;
  moved: number;
  errors: string[];
};

async function wikidataLinks(media: "movie" | "series") {
  const query = `SELECT ?tmdb ?ol WHERE { ?t wdt:${PROPERTY[media]} ?tmdb ; wdt:P144 ?work . ?work wdt:P648 ?ol . }`;
  const url = new URL(WDQS);
  url.searchParams.set("query", query);
  const res = await fetch(url, {
    headers: { Accept: "text/csv", "User-Agent": USER_AGENT },
    cache: "no-store",
    signal: AbortSignal.timeout(100_000),
  });
  if (!res.ok) throw new Error(`Wikidata ${res.status}`);
  return parseWikidataCsv(await res.text());
}

/** Whether a Wikidata sync is due: none yet, a week since the last, or a day since a failed one. */
export async function adaptationsDue(now = new Date()): Promise<boolean> {
  const runs = await getDb()
    .select({ at: syncRuns.ranAt, report: syncRuns.report })
    .from(syncRuns)
    .where(eq(syncRuns.kind, "adaptations"))
    .orderBy(desc(syncRuns.ranAt))
    .limit(14);
  const last = runs.find((r) => (r.report as AdaptationsReport).wikidata);
  if (!last) return true;
  const failed = ((last.report as AdaptationsReport).errors ?? []).length > 0;
  const days = (now.getTime() - last.at.getTime()) / 86_400_000;
  return days >= (failed ? 1 : EVERY_DAYS) - 0.05;
}

/** Moves links from merged Open Library works to the works they now redirect to. */
async function followMergedWorks(report: AdaptationsReport) {
  const db = getDb();
  const ids = (
    await db.selectDistinct({ id: adaptations.bookId }).from(adaptations).where(eq(adaptations.checked, false)).limit(CHECKS_PER_RUN)
  ).map((r) => r.id);
  if (!ids.length) return;
  const found = await existingWorks(ids);
  const missing = ids.filter((id) => !found.has(id)).slice(0, REDIRECTS_PER_RUN);
  for (let i = 0; i < missing.length; i += 6) {
    const batch = missing.slice(i, i + 6);
    const targets = await Promise.all(batch.map((id) => redirectOf(id)));
    for (const [j, target] of targets.entries()) {
      if (!target || target === batch[j]) continue;
      await db.transaction(async (tx) => {
        await tx.execute(sql`
          insert into adaptations (book_id, media, screen_id, via, checked)
          select ${target}, media, screen_id, via, true from adaptations where book_id = ${batch[j]}
          on conflict do nothing`);
        await tx.delete(adaptations).where(eq(adaptations.bookId, batch[j]));
      });
      report.moved++;
    }
  }
  const done = [...ids.filter((id) => found.has(id)), ...missing];
  if (done.length) await db.update(adaptations).set({ checked: true }).where(inArray(adaptations.bookId, done));
  report.checked += done.length;
}

/**
 * One run, with its report saved so Settings can show how it went: Wikidata
 * when it's due (weekly), otherwise a batch of merged-work checks.
 */
export async function syncAdaptations({ wikidata = true }: { wikidata?: boolean } = {}): Promise<AdaptationsReport> {
  const report: AdaptationsReport = { wikidata, films: 0, series: 0, added: 0, editions: 0, checked: 0, moved: 0, errors: [] };
  const db = getDb();
  try {
    // Both together can outlast the cron's time limit, so a Wikidata day skips the checks.
    if (wikidata) await fromWikidata(report);
    else await followMergedWorks(report);
  } catch (error) {
    report.errors.push(error instanceof Error ? error.message : String(error));
  }
  await db
    .insert(syncRuns)
    .values({ kind: "adaptations", report })
    .catch(() => undefined);
  return report;
}

async function fromWikidata(report: AdaptationsReport) {
  const db = getDb();
  const known = new Set(
    (await db.select({ media: adaptations.media, id: adaptations.screenId }).from(adaptations)).map((r) => `${r.media}:${r.id}`),
  );
  let editionBudget = EDITIONS_PER_RUN;
  for (const media of ["movie", "series"] as const) {
    let pairs: Awaited<ReturnType<typeof wikidataLinks>>;
    try {
      pairs = await wikidataLinks(media);
    } catch (error) {
      report.errors.push(`${media}: ${error instanceof Error ? error.message : error}`);
      continue;
    }
    report[media === "movie" ? "films" : "series"] = pairs.length;
    const rows: (typeof adaptations.$inferInsert)[] = [];
    const editions: typeof pairs = [];
    for (const p of pairs) {
      if (p.ol.endsWith("W")) {
        rows.push({ bookId: workNumber(p.ol)!, media, screenId: p.screenId, via: "wikidata" });
      } else if (!known.has(`${media}:${p.screenId}`)) {
        editions.push(p);
      }
    }
    // An edition named for a film that has no link yet: look up its work, a few at a time.
    const todo = editions.slice(0, Math.max(0, editionBudget));
    editionBudget -= todo.length;
    for (let i = 0; i < todo.length; i += 6) {
      const works = await Promise.all(todo.slice(i, i + 6).map((p) => workOfEdition(p.ol)));
      works.forEach((bookId, j) => {
        if (bookId) rows.push({ bookId, media, screenId: todo[i + j].screenId, via: "wikidata" });
      });
      report.editions += works.filter(Boolean).length;
    }
    for (let i = 0; i < rows.length; i += 500) {
      const added = await db
        .insert(adaptations)
        .values(rows.slice(i, i + 500))
        .onConflictDoNothing()
        .returning({ id: adaptations.bookId });
      report.added += added.length;
    }
  }
}

export type AdaptationsStatus = {
  lastRun: { at: Date; report: AdaptationsReport } | null;
  films: number;
  series: number;
  books: number;
};

/** What Settings shows about the adaptations sync. */
export async function adaptationsStatus(): Promise<AdaptationsStatus> {
  const db = getDb();
  const [last] = await db
    .select({ at: syncRuns.ranAt, report: syncRuns.report })
    .from(syncRuns)
    .where(eq(syncRuns.kind, "adaptations"))
    .orderBy(desc(syncRuns.ranAt))
    .limit(1);
  const [counts] = await db
    .select({
      films: sql<number>`count(distinct ${adaptations.screenId}) filter (where ${adaptations.media} = 'movie')`,
      series: sql<number>`count(distinct ${adaptations.screenId}) filter (where ${adaptations.media} = 'series')`,
      books: sql<number>`count(distinct ${adaptations.bookId})`,
    })
    .from(adaptations);
  return {
    lastRun: last ? { at: last.at, report: last.report as unknown as AdaptationsReport } : null,
    films: Number(counts?.films ?? 0),
    series: Number(counts?.series ?? 0),
    books: Number(counts?.books ?? 0),
  };
}
