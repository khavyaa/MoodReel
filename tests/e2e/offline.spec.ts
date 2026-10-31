import { expect, test, type Page } from "@playwright/test";
import { E2E_SETUP_TOKEN } from "../../playwright.config";
import { claimAccount, query, resetDatabase } from "./passkey";

test.describe.configure({ mode: "serial" });

const SESSION = "playwright/.cache/offline-session.json";

test.beforeAll(async ({ browser }) => {
  await resetDatabase();
  const context = await browser.newContext({ storageState: undefined });
  const page = await context.newPage();
  await claimAccount(page, E2E_SETUP_TOKEN);
  await context.storageState({ path: SESSION });
  await context.close();
});

test.use({ storageState: SESSION });

const actions = async () => Number((await query<{ n: string }>("select count(*) as n from title_actions"))[0].n);

/** Waits until the service worker controls this page, so the next loads go through it. */
async function underServiceWorker(page: Page) {
  await page.evaluate(() => navigator.serviceWorker.ready);
  if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
}

test("offline, swipes are kept and sent when the connection returns", async ({ page, context }) => {
  await page.goto("/movies");
  await page.getByRole("button", { name: /Deal 15 films/ }).click();
  await expect(page.getByText("1/15")).toBeVisible();
  const before = await actions();

  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await expect(page.getByText(/You're offline/)).toBeVisible();

  // The deck keeps going; the save waits.
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("2/15")).toBeVisible();
  await page.waitForTimeout(500);
  expect(await actions()).toBe(before);

  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect.poll(actions, { timeout: 15_000 }).toBe(before + 1);
  await expect(page.getByText(/You're offline/)).toHaveCount(0);
});

test("offline, a deal waits and says so, then deals when you're back", async ({ page, context }) => {
  await page.goto("/movies");
  await expect(page.getByRole("heading", { name: "What kind of night is it?" })).toBeVisible();
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await page.getByRole("button", { name: /Deal 15 films/ }).click();
  await expect(page.getByText(/Offline: dealing as soon as you're back/)).toBeVisible();

  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByText(/^1\/\d+$/)).toBeVisible({ timeout: 15_000 });
});

test("the home-screen app opens offline: Saved from your last visit, anything else says you're offline", async ({ page, context }) => {
  await page.goto("/saved");
  await underServiceWorker(page);
  // A visit under the service worker keeps this page for offline.
  await page.goto("/saved");
  const saved = (await page.getByRole("main").getByRole("heading", { level: 2 }).allTextContents()).filter(
    (t) => !/Pick from these/.test(t),
  );
  expect(saved.length).toBeGreaterThan(0);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "For another night" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: saved[0] })).toBeVisible();

  // Never visited, so not kept: the offline page.
  await page.goto("/about");
  await expect(page.getByRole("heading", { name: "You're offline" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Saved" })).toBeVisible();
  // It stays: the page's own scripts were kept with it, so it doesn't break into an error screen once it loads.
  await page.waitForTimeout(2500);
  await expect(page.getByRole("heading", { name: "You're offline" })).toBeVisible();
  await expect(page.getByText(/couldn't load/i)).toHaveCount(0);
  await context.setOffline(false);
});

test("signing out forgets the pages kept for offline", async ({ page }) => {
  await page.goto("/saved");
  await underServiceWorker(page);
  await page.goto("/saved");
  await expect.poll(() => page.evaluate(() => caches.has("moodreel-pages"))).toBe(true);

  await page.goto("/settings");
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(/\/sign-in/);
  await expect.poll(() => page.evaluate(() => caches.has("moodreel-pages"))).toBe(false);
});
