import { expect, test } from "@playwright/test";
import { E2E_SETUP_TOKEN } from "../../playwright.config";
import { claimAccount, query, resetDatabase } from "./passkey";

test.describe.configure({ mode: "serial" });

const SESSION = "playwright/.cache/fit-session.json";

test.beforeAll(async ({ browser }) => {
  await resetDatabase();
  // A film from a book you've read: its card carries the most (badges, the book), the hardest to fit.
  const context = await browser.newContext({ storageState: undefined });
  const page = await context.newPage();
  await claimAccount(page, E2E_SETUP_TOKEN);
  await context.storageState({ path: SESSION });
  await context.close();
  await query("delete from adaptations");
  await query("insert into adaptations (book_id, media, screen_id, via, checked) values (7000, 'movie', 1000, 'wikidata', true)");
});

test.afterAll(async () => {
  await query("delete from adaptations");
});

test.use({ storageState: SESSION });

// The audit's sizes: small and large iPhones, and a 1280×800 Mac window.
const SIZES = [
  { width: 375, height: 667 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 393, height: 852 },
  { width: 1280, height: 800 },
];

test("three taps, no scroll: Deal is in view on the start screen, and the deck's buttons and Undo fit one screen", async ({ page }, info) => {
  test.skip(info.project.name !== "laptop", "Sizes are set here, one by one.");
  for (const size of SIZES) {
    await page.setViewportSize(size);
    await page.goto("/movies");
    const deal = page.getByRole("button", { name: /Deal 15 films/ });
    await expect(deal).toBeInViewport({ ratio: 1 });
    await deal.click();
    await expect(page.getByText(/^1\/\d+$/)).toBeVisible();
    // No tab bar over the deck…
    await expect(page.locator("nav.fixed")).toHaveCount(0);
    // …and every action is fully on screen, with nothing to scroll.
    for (const name of ["Skip", "Not for me", "Seen it", "Save"]) {
      await expect(page.getByRole("button", { name, exact: true })).toBeInViewport({ ratio: 1 });
    }
    await page.getByRole("button", { name: "Skip", exact: true }).click();
    await expect(page.getByRole("button", { name: /Undo/ })).toBeInViewport({ ratio: 1 });
    expect(await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight), `${size.width}×${size.height}`).toBeLessThanOrEqual(1);
    // …and nothing inside the deck is cut off to make it fit.
    expect(await page.evaluate(() => { const m = document.querySelector("main")!; return m.scrollHeight - m.clientHeight; }), `${size.width}×${size.height} main`).toBeLessThanOrEqual(1);
    // Leave the deck for the next size.
    await page.goto("/movies");
    await page.getByRole("button", { name: "Start again" }).click().catch(() => undefined);
  }
});
