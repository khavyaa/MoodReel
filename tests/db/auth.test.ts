import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

/*
 * Exercises the real auth endpoints against a real Postgres (DATABASE_URL_TEST).
 * Completing a passkey ceremony needs a browser authenticator, so that part is
 * covered by the end-to-end tests; here we check the gates around it.
 */

const TEST_URL = process.env.DATABASE_URL_TEST;
const SECRET = "test-secret-with-enough-length-0123456789";

// lib/auth reads env at import, so configure before importing anything.
process.env.DATABASE_URL = TEST_URL;
process.env.BETTER_AUTH_SECRET = SECRET;
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";

type Modules = {
  auth: typeof import("@/lib/auth").auth;
  db: typeof import("@/lib/db");
  owner: typeof import("@/lib/owner-server");
  grants: typeof import("@/lib/owner");
  schema: typeof import("@/lib/db/schema");
};
let m: Modules;

function api(path: string, init?: RequestInit) {
  return m.auth.handler(
    new Request(`http://localhost:3000/api/auth${path}`, {
      ...init,
      headers: { origin: "http://localhost:3000", ...(init?.headers ?? {}) },
    }),
  );
}

describe.skipIf(!TEST_URL)("auth against Postgres", () => {
  beforeAll(async () => {
    execFileSync("node", ["scripts/migrate.mjs"], { env: { ...process.env, DATABASE_URL: TEST_URL } });
    m = {
      auth: (await import("@/lib/auth")).auth,
      db: await import("@/lib/db"),
      owner: await import("@/lib/owner-server"),
      grants: await import("@/lib/owner"),
      schema: await import("@/lib/db/schema"),
    };
  });

  beforeEach(async () => {
    // Users cascade to sessions, passkeys and all app data.
    await m.db.getDb().delete(m.schema.user);
  });

  afterAll(async () => {
    await m?.db.closeDb();
  });

  it("creates the owner once and returns the same account after", async () => {
    const first = await m.owner.getOrCreateOwner();
    const second = await m.owner.getOrCreateOwner();
    expect(second.id).toBe(first.id);
    const users = await m.db.getDb().select().from(m.schema.user);
    expect(users).toHaveLength(1);
  });

  it("refuses a second account even when asked directly", async () => {
    await m.owner.getOrCreateOwner();
    const ctx = await m.auth.$context;
    await expect(
      ctx.internalAdapter.createUser(
        { name: "Intruder", email: "intruder@example.com" },
        { method: "email-password" },
      ),
    ).rejects.toThrow(/already has an owner/);
  });

  it("refuses to start passkey registration for a signed-out browser without a grant", async () => {
    await m.owner.getOrCreateOwner();
    const res = await api("/passkey/generate-register-options");
    expect(res.status).toBe(401);
  });

  it("refuses a forged or expired grant", async () => {
    const owner = await m.owner.getOrCreateOwner();
    const forged = m.grants.signOwnerGrant(owner.id, "not-the-real-secret-0123456789abcdef");
    const expired = m.grants.signOwnerGrant(owner.id, SECRET, Date.now() - 60 * 60 * 1000);
    for (const grant of [forged, expired, "garbage"]) {
      const res = await api(`/passkey/generate-register-options?context=${encodeURIComponent(grant)}`);
      expect(res.status, grant.slice(0, 12)).toBe(401);
    }
  });

  it("starts passkey registration for the owner when the grant is valid", async () => {
    const owner = await m.owner.getOrCreateOwner();
    const grant = m.grants.signOwnerGrant(owner.id, SECRET);
    const res = await api(`/passkey/generate-register-options?context=${encodeURIComponent(grant)}`);
    expect(res.status).toBe(200);
    const options = await res.json();
    expect(options.rp).toMatchObject({ id: "localhost", name: "MoodReel" });
    expect(options.challenge).toEqual(expect.any(String));
  });

  it("does not offer any password or email sign-up route", async () => {
    const res = await api("/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "x@example.com", password: "correct horse battery", name: "x" }),
    });
    expect([400, 404]).toContain(res.status);
    const users = await m.db.getDb().select().from(m.schema.user);
    expect(users).toHaveLength(0);
  });

  it("keeps passkey management behind a session", async () => {
    const res = await api("/passkey/list-user-passkeys");
    expect(res.status).toBe(401);
  });
});
