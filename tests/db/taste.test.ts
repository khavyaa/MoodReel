import { execFileSync } from "node:child_process";
import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

/*
 * Ratings teach taste once per title, from the current rating: re-rating
 * replaces the old one instead of adding to it.
 */

const TEST_URL = process.env.DATABASE_URL_TEST;
process.env.DATABASE_URL = TEST_URL;

type Modules = {
  db: typeof import("@/lib/db");
  schema: typeof import("@/lib/db/schema");
  picks: typeof import("@/lib/picks/server");
};
let m: Modules;
const USER = "taste-test-user";
const THRILLER = "53";

describe.skipIf(!TEST_URL)("taste from ratings", () => {
  beforeAll(async () => {
    execFileSync("node", ["scripts/migrate.mjs"], { env: { ...process.env, DATABASE_URL: TEST_URL } });
    m = { db: await import("@/lib/db"), schema: await import("@/lib/db/schema"), picks: await import("@/lib/picks/server") };
    const db = m.db.getDb();
    const { user, titleActions, titleStates } = m.schema;
    await db.delete(user).where(eq(user.id, USER));
    await db.insert(user).values({ id: USER, name: "Taste", email: "taste@example.com", emailVerified: true });
    // A thriller you picked and finished.
    const key = { userId: USER, media: "movie" as const, source: "tmdb" as const, externalId: "1" };
    await db.insert(titleActions).values([
      { ...key, action: "picked", tags: [THRILLER, "lang:en"] },
      { ...key, action: "finished", tags: [THRILLER, "lang:en"] },
    ]);
    await db.insert(titleStates).values({ ...key, seen: true });
  });

  async function rate(rating: number | null) {
    const db = m.db.getDb();
    const { titleStates } = m.schema;
    await db.update(titleStates).set({ rating }).where(and(eq(titleStates.userId, USER), eq(titleStates.externalId, "1")));
  }
  const thriller = async () => (await m.picks.tasteFor(USER, "movie")).tags[THRILLER] ?? 0;

  it("a five-star rating pulls the genre up, a one-star pulls it down, and re-rating replaces", async () => {
    await rate(null);
    const unrated = await thriller();
    await rate(10);
    const loved = await thriller();
    await rate(10);
    expect(await thriller()).toBeCloseTo(loved);
    await rate(2);
    const disliked = await thriller();
    expect(loved).toBeGreaterThan(unrated);
    expect(disliked).toBeLessThan(unrated);
  });
});
