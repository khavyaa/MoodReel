import { expect, test } from "@playwright/test";
import { flow } from "./flow";
import { E2E_SETUP_TOKEN } from "../../playwright.config";
import { claimAccount, query, resetDatabase } from "./passkey";

test.describe.configure({ mode: "serial" });

const SESSION = "playwright/.cache/undo-session.json";

test.beforeAll(async ({ browser }) => {
  await resetDatabase();
  const context = await browser.newContext({ storageState: undefined });
  const page = await context.newPage();
  await claimAccount(page, E2E_SETUP_TOKEN);
  await context.storageState({ path: SESSION });
  await context.close();
});

test.use({ storageState: SESSION });

const ownerId = async () => (await query<{ id: string }>('select id from "user" limit 1'))[0].id;

/** A film's state, set directly. */
async function film(id: number, set: { saved?: boolean; seen?: boolean; rating?: number | null }) {
  await query(
    `insert into title_states (user_id, media, source, external_id, saved, seen, rating)
     values ($1, 'movie', 'tmdb', $2, $3, $4, $5)
     on conflict (user_id, media, source, external_id) do update set saved = excluded.saved, seen = excluded.seen, rating = excluded.rating`,
    [await ownerId(), String(id), set.saved ?? false, set.seen ?? false, set.rating ?? null],
  );
}

const stateOf = async (id: number) =>
  (await query<{ saved: boolean; seen: boolean; disliked: boolean; rating: number | null }>(
    "select saved, seen, disliked, rating from title_states where media = 'movie' and external_id = $1",
    [String(id)],
  ))[0];

test("Remove from Saved, then Undo: it's back in Saved and in the flow", async ({ page }) => {
  await film(1000, { saved: true });
  await page.goto("/saved");
  const saved = flow(page, "Saved titles");
  await expect(saved.getByRole("heading", { name: "English Thriller 1", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Removed English Thriller 1 from Saved" })).toBeVisible();
  await expect.poll(async () => (await stateOf(1000)).saved).toBe(false);

  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "English Thriller 1 is back in Saved" })).toBeVisible();
  await expect.poll(async () => (await stateOf(1000)).saved).toBe(true);
  await expect(saved.getByRole("heading", { name: "English Thriller 1", exact: true })).toBeVisible();
});

test("Not for me in the deck lands in Turned down, and Restore lets it come up again", async ({ page }) => {
  await page.goto("/movies");
  await page.getByRole("button", { name: /Deal 15 films/ }).click();
  await expect(page.getByText("1/15")).toBeVisible();
  const title = (await page.getByRole("heading", { level: 2 }).first().textContent())!.trim();
  await page.getByRole("button", { name: "Not for me", exact: true }).click();
  await expect(page.getByText("2/15")).toBeVisible();
  await expect.poll(async () => (await query("select 1 from title_states where disliked")).length).toBe(1);

  await page.goto("/history");
  await page.getByRole("link", { name: "Turned down · 1" }).click();
  const down = flow(page, "Turned down");
  await expect(down.getByRole("heading", { name: title, exact: true })).toBeVisible();
  await expect(down.getByText(/^Not for me · /)).toBeVisible();

  await down.getByRole("button", { name: "Restore" }).click();
  await expect(page.getByRole("status").filter({ hasText: `Restored: ${title} can come up again` })).toBeVisible();
  await expect.poll(async () => (await query("select 1 from title_states where disliked")).length).toBe(0);
  // Its Not for me is gone from the log too, so it teaches nothing any more.
  expect(await query("select 1 from title_actions where action = 'disliked'")).toEqual([]);
});

test("Not seen takes a mis-tapped Seen it off the list, and Undo brings it back with its stars", async ({ page }) => {
  await film(1001, { seen: true, rating: 8 });
  await page.goto("/history?tab=seen");
  const seen = flow(page, "Seen and read");
  await expect(seen.getByRole("heading", { name: "English Thriller 2", exact: true })).toBeVisible();

  await seen.getByRole("button", { name: "Not seen" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Not seen: English Thriller 2" })).toBeVisible();
  await expect.poll(async () => await stateOf(1001)).toMatchObject({ seen: false, rating: null });

  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "English Thriller 2 is back in Seen & read" })).toBeVisible();
  await expect.poll(async () => await stateOf(1001)).toMatchObject({ seen: true, rating: 8 });
});

test("the head-to-head goes back a round, and from the first round back to the deck", async ({ page }) => {
  await page.goto("/movies");
  await page.getByRole("button", { name: /Deal 15 films/ }).click();
  await expect(page.getByText("1/15")).toBeVisible();
  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("heading", { name: "This or that?" })).toBeVisible();
  await expect(page.getByText(/Round 1 of 3/)).toBeVisible();

  await page.getByRole("button", { name: /^Choose / }).first().click();
  await expect(page.getByText(/Round 2 of 3/)).toBeVisible();
  await page.getByRole("button", { name: "Back a round" }).click();
  await expect(page.getByText(/Round 1 of 3/)).toBeVisible();

  // Before the first round is the deck: the last save is taken back and its card is on top again.
  await page.getByRole("button", { name: "Back to the deck" }).click();
  await expect(page.getByText("4/15")).toBeVisible();
});

test("a head-to-head from Saved: the browser's Back returns to Saved", async ({ page }) => {
  for (const id of [1002, 1003, 1004]) await film(id, { saved: true });
  await page.goto("/saved");
  await page.getByRole("button", { name: "Pick from these" }).click();
  await page.getByRole("button", { name: "Pick from my saved" }).click();
  await expect(page.getByRole("heading", { name: "This or that?" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Back to Saved" })).toBeVisible();

  await page.goBack();
  await expect(page.getByRole("heading", { name: "This or that?" })).toHaveCount(0);
  await expect(page).toHaveURL(/\/saved$/);
  await expect(flow(page, "Saved titles")).toBeVisible();
});

test("a title's details keep focus inside, and Escape hands it back to the button that opened them", async ({ page }) => {
  await film(1005, { saved: true });
  await page.goto("/saved");
  const opener = page.getByRole("button", { name: "Details: English Thriller 6" });
  await opener.click();
  const sheet = page.getByRole("dialog", { name: "English Thriller 6" });
  await expect(sheet.getByRole("heading", { name: "English Thriller 6" })).toBeVisible();

  // Tab goes round the sheet (and out to the browser's own toolbar, which the page sees as the body),
  // never to the page behind it.
  const where = () => page.evaluate(() => (document.activeElement?.closest("dialog") ? "sheet" : document.activeElement === document.body ? "browser" : "page"));
  const seen = new Set<string>();
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press("Tab");
    seen.add(await where());
  }
  expect(seen.has("page")).toBe(false);
  expect(seen.has("sheet")).toBe(true);
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  await expect(opener).toBeFocused();
});
