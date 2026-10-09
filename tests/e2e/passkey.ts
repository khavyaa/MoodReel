import type { Page } from "@playwright/test";
import pg from "pg";

/**
 * Attaches a virtual platform authenticator (a stand-in for Face ID / Touch ID)
 * to the page. It keeps the credentials it creates, so a later sign-in on the
 * same page finds the passkey.
 */
export async function addVirtualAuthenticator(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
}

/** Removes the owner (and through cascades, everything else) so each run starts unclaimed. */
export async function resetDatabase() {
  const client = new pg.Client({
    connectionString:
      process.env.DATABASE_URL_TEST ?? "postgres://moodreel:moodreel@localhost:5433/moodreel_test",
  });
  await client.connect();
  try {
    await client.query('delete from "user"');
    await client.query('delete from "verification"');
  } finally {
    await client.end();
  }
}

/** Claims the account through /setup with a virtual passkey and lands signed in. */
export async function claimAccount(page: Page, token: string) {
  await addVirtualAuthenticator(page);
  await page.goto("/setup");
  await page.getByLabel("Setup token").fill(token);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Save a passkey" }).click();
  await page.waitForURL(/\/movies$/);
}

/** Runs one query against the test database. */
export async function query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const client = new pg.Client({
    connectionString:
      process.env.DATABASE_URL_TEST ?? "postgres://moodreel:moodreel@localhost:5433/moodreel_test",
  });
  await client.connect();
  try {
    return (await client.query(sql, params)).rows as T[];
  } finally {
    await client.end();
  }
}
