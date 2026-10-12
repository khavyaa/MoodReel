import { expect, test } from "@playwright/test";
import { E2E_SETUP_TOKEN } from "../../playwright.config";
import { claimAccount, query, resetDatabase } from "./passkey";

test.describe.configure({ mode: "serial" });

const SESSION = "playwright/.cache/books-flow-session.json";

test.beforeAll(async ({ browser }) => {
  await resetDatabase();
  await query("delete from book_signals; delete from nyt_sync; delete from sync_runs;");
  const context = await browser.newContext({ storageState: undefined });
  const page = await context.newPage();
  await claimAccount(page, E2E_SETUP_TOKEN);
  await context.storageState({ path: SESSION });
  await context.close();
});

test.use({ storageState: SESSION });

test("the NYT sync only runs for Vercel's cron, and stores adult-list bestsellers", async ({ request }) => {
  expect((await request.get("/api/cron/nyt", { headers: { authorization: "" } })).status()).toBe(401);
  expect((await request.get("/api/cron/nyt", { headers: { authorization: "Bearer wrong" } })).status()).toBe(401);

  const res = await request.get("/api/cron/nyt", { headers: { authorization: "Bearer e2e-cron-secret" } });
  expect(res.status()).toBe(200);
  const report = await res.json();
  expect(report.errors).toEqual([]);
  expect(report.matched).toBe(1);

  const signals = await query<{ isbn13: string; work_id: number; weeks_on_list: number }>(
    "select isbn13, work_id, weeks_on_list from book_signals",
  );
  // The young-adult list was ignored; the hardcover-fiction bestseller was matched to its Open Library work.
  expect(signals).toEqual([{ isbn13: "9780000007100", work_id: 7100, weeks_on_list: 12 }]);
});

test("Settings shows how the last bestseller sync went", async ({ page }) => {
  await page.goto("/settings");
  const section = page.getByRole("heading", { name: "Book bestsellers" }).locator("xpath=../..");
  await expect(section.getByText(/weeks? fetched, 1 matched/)).toBeVisible();
  await expect(section.getByText(/\d+ weeks? synced, latest 4 Oct 2026/)).toBeVisible();
  await expect(section.getByText("1 bestseller, 1 matched to Open Library")).toBeVisible();
  await expect(section.getByText("Problems")).toHaveCount(0);
});

test("books: taps → deck → head-to-head → read next, on your Reading list", async ({ page }) => {
  await page.goto("/books");
  await expect(page.getByRole("heading", { name: "What do you feel like reading?" })).toBeVisible();
  await expect(page.getByText("Length", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Gripping" }).click();
  await page.getByRole("button", { name: "Medium" }).click();
  await page.getByRole("button", { name: /Deal 15 books/ }).click();
  await expect(page.getByText(/^1\/13$/)).toBeVisible();

  // Twelve rated thrillers plus the NYT-only bestseller; never YA, romance, a graphic novel or a children's book.
  const [session] = await query<{ deck: { source: string; externalId: string }[]; media: string }>(
    "select deck, media from pick_sessions order by created_at desc limit 1",
  );
  expect(session.media).toBe("book");
  const dealt = session.deck.map((e) => Number(e.externalId));
  expect(dealt).toContain(7100);
  for (const never of [7900, 7901, 7902, 7903]) expect(dealt).not.toContain(never);
  expect(session.deck.every((e) => e.source === "openlibrary")).toBe(true);

  // A book card: author, pages, "Read it" instead of "Seen it".
  await expect(page.getByText(/^by Author \d+$|^by Nyt Author$/).first()).toBeVisible();
  await expect(page.getByText(/2018 · 340 pages · Medium/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Read it", exact: true })).toBeVisible();

  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("heading", { name: "This or that?" })).toBeVisible();
  for (let round = 1; round <= 3; round++) await page.getByRole("button", { name: /^Choose / }).first().click();

  await expect(page.getByText(/Read next · Gripping/)).toBeVisible();
  await expect(page.getByText("340 pages", { exact: true })).toBeVisible();
  await expect(page.getByText(/on your Reading list/)).toBeVisible();
  await expect(page.getByRole("link", { name: /Where to get it/ })).toHaveAttribute("href", /^https:\/\/www\.amazon\.in\/s\?k=.+&i=stripbooks$/);

  await expect
    .poll(async () => (await query<{ n: string }>("select count(*) as n from title_states where media = 'book' and source = 'openlibrary' and watching_since is not null"))[0].n)
    .toBe("1");
  // Book taste learns from subjects.
  const [{ tags }] = await query<{ tags: string[] }>("select tags from title_actions where media = 'book' limit 1");
  expect(tags).toContain("s:thriller");
});

test("Saved shows Reading on top; a week later the books screen asks, and 'gave up' counts against it", async ({ page }) => {
  await page.goto("/saved");
  await expect(page.getByRole("heading", { name: "Reading · 1" })).toBeVisible();
  await expect(page.getByText("Saved · 3 books")).toBeVisible();
  await expect(page.getByRole("link", { name: /Where to get it/ }).first()).toBeVisible();

  // Not after three days (that's series); after eight it asks.
  await query("update title_states set watching_since = now() - interval '4 days' where media = 'book' and watching_since is not null");
  await page.goto("/books");
  await expect(page.getByText(/^Still reading .+\?$/)).toHaveCount(0);
  await query("update title_states set watching_since = now() - interval '8 days' where media = 'book' and watching_since is not null");
  await page.goto("/books");
  await expect(page.getByText(/^Still reading .+\?$/)).toBeVisible();

  await page.getByRole("button", { name: "Gave up" }).click();
  await expect(page.getByText(/won't come back/)).toBeVisible();
  await expect
    .poll(async () => (await query<{ disliked: boolean; reading: boolean }>("select disliked, watching_since is not null as reading from title_states where media = 'book' and picked_at is not null"))[0])
    .toEqual({ disliked: true, reading: false });
  const [{ n }] = await query<{ n: string }>("select count(*) as n from title_actions where media = 'book' and action = 'dropped'");
  expect(n).toBe("1");

  await page.goto("/history");
  await expect(page.getByText("You gave up on this one.")).toBeVisible();
});
