import { expect, test, type Browser, type Page } from "@playwright/test";
import { E2E_SETUP_TOKEN } from "../../playwright.config";
import { claimAccount, query, resetDatabase } from "./passkey";

/*
 * The README's screenshots, from the fake TMDb / Open Library data (no real
 * library, no real posters). Not part of the test run: `npm run screenshots`
 * sets SCREENSHOTS=1 and writes docs/screenshots/*.png.
 */

test.skip(!process.env.SCREENSHOTS, "Run with `npm run screenshots`.");
test.describe.configure({ mode: "serial" });

const OUT = "docs/screenshots";

test.beforeAll(async () => {
  await resetDatabase();
  // A film of a book "you've read", so a card shows the book link and badge.
  await query("delete from adaptations");
  await query("insert into adaptations (book_id, media, screen_id, via, checked) values (7000, 'movie', 1003, 'wikidata', true)");
});

test.afterAll(async () => {
  await query("delete from adaptations");
});

async function signedIn(browser: Browser, opts: { width: number; height: number; scale: number; dark?: boolean }) {
  const context = await browser.newContext({
    viewport: { width: opts.width, height: opts.height },
    deviceScaleFactor: opts.scale,
    colorScheme: opts.dark ? "dark" : "light",
    isMobile: opts.width < 600,
    hasTouch: opts.width < 600,
  });
  const page = await context.newPage();
  await claimAccount(page, E2E_SETUP_TOKEN);
  return { context, page };
}

const shot = (page: Page, name: string) => page.screenshot({ path: `${OUT}/${name}.png` });
const settle = (page: Page) => page.waitForTimeout(600);

test("iPhone screens", async ({ browser }, info) => {
  test.skip(info.project.name !== "iphone");
  const { context, page } = await signedIn(browser, { width: 390, height: 844, scale: 2 });
  const owner = (await query<{ id: string }>('select id from "user" limit 1'))[0].id;
  await query(
    "insert into title_states (user_id, media, source, external_id, seen, rating) values ($1, 'book', 'openlibrary', '7000', true, 8)",
    [owner],
  );

  await page.goto("/movies");
  await expect(page.getByRole("heading", { name: "What kind of night is it?" })).toBeVisible();
  await settle(page);
  await shot(page, "iphone-1-start");

  await page.getByRole("button", { name: /Deal 15 films/ }).click();
  await expect(page.getByText("You've read the book")).toBeVisible();
  await settle(page);
  await shot(page, "iphone-2-deck");

  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Save", exact: true }).click();
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: /^Choose / }).first().click();
  await expect(page.getByText("Saved to your History")).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await settle(page);
  await shot(page, "iphone-3-pick");

  await page.goto("/saved");
  await page.getByRole("button", { name: /^Details: / }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await settle(page);
  await shot(page, "iphone-4-details");
  await context.close();
});

test("Mac screens", async ({ browser }, info) => {
  test.skip(info.project.name !== "laptop");
  // The landing page, signed out, on its first card (taken well before it turns by itself).
  const visitor = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });
  const landing = await visitor.newPage();
  await landing.goto("/");
  await expect(landing.getByText("Films, series and books for the mood you're in.", { exact: true })).toBeVisible();
  await landing.waitForTimeout(1200);
  await shot(landing, "mac-landing");
  await visitor.close();

  const light = await signedIn(browser, { width: 1440, height: 900, scale: 1.5 });
  await light.page.goto("/movies");
  await light.page.getByRole("button", { name: /Deal 15 films/ }).click();
  await expect(light.page.getByText(/^1\/\d+$/)).toBeVisible();
  await settle(light.page);
  await shot(light.page, "mac-deck-playful");
  await light.context.close();

  const dark = await signedIn(browser, { width: 1440, height: 900, scale: 1.5, dark: true });
  await dark.page.goto("/movies");
  await dark.page.getByRole("button", { name: "Dark", exact: true }).click();
  await dark.page.getByRole("button", { name: /Deal 15 films/ }).click();
  await expect(dark.page.getByText(/^1\/\d+$/)).toBeVisible();
  await settle(dark.page);
  await shot(dark.page, "mac-deck-cinematic");
  await dark.context.close();
});
