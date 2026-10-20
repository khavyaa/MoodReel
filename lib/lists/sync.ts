import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { listItems, syncRuns } from "@/lib/db/schema";
import { LISTS, type ListDef } from "./catalog";

/*
 * Award winners from Wikidata into `list_items`: every title that received the
 * list's award (P166), with its TMDb id (P4947, films) or Open Library work
 * (P648, books) and the year it won. Synced weekly by the daily cron; a list
 * opened before its first sync is filled on the spot.
 */

const WDQS = process.env.WIKIDATA_SPARQL_URL || "https://query.wikidata.org/sparql";
const USER_AGENT = "MoodReel/1.0 (https://github.com/khavyaa/MoodReel; personal recommender)";
const EVERY_DAYS = 6;

/** The SPARQL for one award list. Exported for tests. */
export function listQuery(def: ListDef): string {
  if (def.source.kind !== "wikidata") throw new Error(`${def.slug} isn't a Wikidata list`);
  const idProp = def.media === "book" ? "P648" : "P4947";
  const onlyWorks = def.media === "book" ? 'FILTER(REGEX(?id, "^OL[0-9]+W$"))' : "";
  return `SELECT ?id (MIN(YEAR(?date)) AS ?year) WHERE {
  ?i p:P166 ?st . ?st ps:P166 wd:${def.source.award} . ?i wdt:${idProp} ?id . ${onlyWorks}
  OPTIONAL { ?st pq:P585 ?date }
} GROUP BY ?id`;
}

/** Pure: Wikidata's CSV answer as (id, year) pairs. Books' "OL123W" become 123. */
export function parseListCsv(csv: string, media: ListDef["media"]): { id: number; year: number | null }[] {
  const seen = new Set<number>();
  return csv
    .split(/\r?\n/)
    .slice(1)
    .flatMap((line) => {
      const [raw, yearRaw] = line.split(",").map((s) => s.trim());
      const id = media === "book" ? Number(raw?.match(/^OL(\d+)W$/)?.[1]) : Number(raw);
      if (!Number.isInteger(id) || id <= 0 || seen.has(id)) return [];
      seen.add(id);
      const year = Number(yearRaw);
      return [{ id, year: Number.isInteger(year) && year > 1800 ? year : null }];
    });
}

/** Fetches one award list from Wikidata and replaces its stored titles. Returns how many it holds. */
export async function syncList(def: ListDef): Promise<number> {
  const url = new URL(WDQS);
  url.searchParams.set("query", listQuery(def));
  const res = await fetch(url, {
    headers: { Accept: "text/csv", "User-Agent": USER_AGENT },
    cache: "no-store",
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`Wikidata ${res.status}`);
  const rows = parseListCsv(await res.text(), def.media);
  // An empty answer is more likely a hiccup than a list that stopped existing: keep what's there.
  if (!rows.length) return 0;
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx.delete(listItems).where(eq(listItems.listSlug, def.slug));
    await tx.insert(listItems).values(rows.map((r) => ({ listSlug: def.slug, media: def.media, externalId: r.id, year: r.year })));
  });
  return rows.length;
}

/** A Wikidata list opened before it's ever been synced: fill it now (a few seconds), so the page isn't empty. */
export async function ensureListItems(def: ListDef): Promise<void> {
  if (def.source.kind !== "wikidata") return;
  const [row] = await getDb()
    .select({ n: sql<number>`count(*)` })
    .from(listItems)
    .where(eq(listItems.listSlug, def.slug));
  if (Number(row?.n ?? 0) === 0) await syncList(def).catch(() => 0);
}

export type ListsReport = { lists: Record<string, number>; errors: string[] };

/** The last list sync, for Settings and for when the next one is due. */
export async function lastListsSync(): Promise<{ at: Date; report: ListsReport } | null> {
  const [last] = await getDb()
    .select({ at: syncRuns.ranAt, report: syncRuns.report })
    .from(syncRuns)
    .where(eq(syncRuns.kind, "lists"))
    .orderBy(desc(syncRuns.ranAt))
    .limit(1);
  return last ? { at: last.at, report: last.report as ListsReport } : null;
}

/** Whether the weekly list sync is due (or a day after a failed one). */
export async function listsDue(now = new Date()): Promise<boolean> {
  const last = await lastListsSync();
  if (!last) return true;
  const failed = (last.report.errors ?? []).length > 0;
  return (now.getTime() - last.at.getTime()) / 86_400_000 >= (failed ? 1 : EVERY_DAYS) - 0.05;
}

/** Every Wikidata list, one after another (Wikidata rate-limits), with a report for Settings. */
export async function syncLists(): Promise<ListsReport> {
  const report: ListsReport = { lists: {}, errors: [] };
  for (const def of LISTS.filter((l) => l.source.kind === "wikidata")) {
    try {
      report.lists[def.slug] = await syncList(def);
    } catch (error) {
      report.errors.push(`${def.slug}: ${error instanceof Error ? error.message : error}`);
    }
  }
  await getDb()
    .insert(syncRuns)
    .values({ kind: "lists", report })
    .catch(() => undefined);
  return report;
}
