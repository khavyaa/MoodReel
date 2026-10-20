import { expect, test } from "@playwright/test";
import { E2E_SETUP_TOKEN } from "../../playwright.config";
import { claimAccount, query, resetDatabase } from "./passkey";

test.describe.configure({ mode: "serial" });

const SESSION = "playwright/.cache/details-session.json";

test.beforeAll(async ({ browser }) => {
  await resetDatabase();
  const context = await browser.newContext({ storageState: undefined });
  const page = await context.newPage();
  await claimAccount(page, E2E_SETUP_TOKEN);
  await context.storageState({ path: SESSION });
  await context.close();
});

test.use({ storageState: SESSION });

test("Details from Saved shows everything: the full synopsis, its rating scale, people, where to watch", async ({ page }) => {
  const owner = (await query<{ id: string }>('select id from "user" limit 1'))[0].id;
  await query(
    `insert into title_states (user_id, media, source, external_id, saved) values ($1, 'movie', 'tmdb', '1003', true)`,
    [owner],
  );
  await page.goto("/saved");
  await page.getByRole("button", { name: "Details: English Thriller 4" }).click();
  const sheet = page.getByRole("dialog", { name: "English Thriller 4" });
  // The fake synopsis ends "The end."; lists clamp it, the sheet doesn't.
  await expect(sheet.getByText(/The end\.$/)).toBeVisible();
  await expect(sheet.getByText(/\/10 · 2,500 votes/)).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Dev Director" })).toBeVisible();
  await expect(sheet.getByRole("link", { name: /Where to watch/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
});

test("on a person's page, a title opens its details, fetched there and then", async ({ page }) => {
  await page.goto("/people/tmdb/703");
  await page.getByRole("button", { name: "English Thriller 9", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "English Thriller 9" });
  await expect(sheet.getByRole("heading", { name: "English Thriller 9" })).toBeVisible();
  await expect(sheet.getByText(/1h 58m/)).toBeVisible();
  await sheet.getByRole("button", { name: "Close" }).click();
  await expect(sheet).toHaveCount(0);
});
