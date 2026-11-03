import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { and, eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

/*
 * Films go on a Tonight list when picked: asked about 3 hours later, then once
 * a day. Film picks never answered before that list existed join it once.
 */

const TEST_URL = process.env.DATABASE_URL_TEST;
process.env.DATABASE_URL = TEST_URL;

type Modules = {
  db: typeof import("@/lib/db");
  schema: typeof import("@/lib/db/schema");
  picks: typeof import("@/lib/picks/server");
};
let m: Modules;
const USER = "tonight-test-user";
const film = (externalId: string) => ({ userId: USER, media: "movie" as const, source: "tmdb" as const, externalId });
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000);

describe.skipIf(!TEST_URL)("films on the Tonight list", () => {
  beforeAll(async () => {
    execFileSync("node", ["scripts/migrate.mjs"], { env: { ...process.env, DATABASE_URL: TEST_URL } });
    m = { db: await import("@/lib/db"), schema: await import("@/lib/db/schema"), picks: await import("@/lib/picks/server") };
    const db = m.db.getDb();
    await db.delete(m.schema.user).where(eq(m.schema.user.id, USER));
    await db.insert(m.schema.user).values({ id: USER, name: "Tonight", email: "tonight@example.com", emailVerified: true });
  });

  async function onTonight(since: Date, checkedInAt: Date | null) {
    const db = m.db.getDb();
    const { titleStates } = m.schema;
    await db.delete(titleStates).where(eq(titleStates.userId, USER));
    await db.insert(titleStates).values({ ...film("1"), watchingSince: since, checkedInAt });
  }

  it("asks 3 hours after the pick, then once a day", async () => {
    const pending = () => m.picks.pendingCheckIn(USER, "movie");
    await onTonight(hoursAgo(2), null);
    expect(await pending()).toBeNull();
    await onTonight(hoursAgo(4), null);
    expect(await pending()).toEqual({ id: 1 });
    await onTonight(hoursAgo(30), hoursAgo(12));
    expect(await pending()).toBeNull();
    await onTonight(hoursAgo(30), hoursAgo(25));
    expect(await pending()).toEqual({ id: 1 });
  });

  it("the migration puts unanswered, unseen film picks on Tonight, and nothing else", async () => {
    const db = m.db.getDb();
    const { pickSessions, titleStates } = m.schema;
    await db.delete(titleStates).where(eq(titleStates.userId, USER));
    await db.delete(pickSessions).where(eq(pickSessions.userId, USER));
    const picked = hoursAgo(48);
    const session = (id: string, followUp: string | null) => ({
      userId: USER,
      media: "movie" as const,
      mood: "gripping",
      energy: 1,
      time: 1,
      status: "picked" as const,
      pick: { source: "tmdb" as const, externalId: id },
      followUp,
      completedAt: picked,
    });
    await db.insert(pickSessions).values([session("10", null), session("11", "later"), session("12", null)]);
    await db.insert(titleStates).values([film("10"), film("11"), { ...film("12"), seen: true }]);

    await db.execute(sql.raw(readFileSync("drizzle/0009_films_tonight.sql", "utf8")));

    const since = async (id: string) =>
      (await db.query.titleStates.findFirst({ where: and(eq(titleStates.userId, USER), eq(titleStates.externalId, id)) }))?.watchingSince;
    expect((await since("10"))?.getTime()).toBe(picked.getTime());
    expect(await since("11")).toBeNull(); // answered under the old question
    expect(await since("12")).toBeNull(); // already seen
  });
});
