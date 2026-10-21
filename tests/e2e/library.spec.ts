import { expect, test } from "@playwright/test";
import { bringToFront, flow } from "./flow";
import { E2E_SETUP_TOKEN } from "../../playwright.config";
import { claimAccount, query, resetDatabase } from "./passkey";

test.describe.configure({ mode: "serial" });

const SESSION = "playwright/.cache/library-session.json";

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

/** Inserts a title's state directly, `minutesAgo` old. */
async function state(media: string, id: number, set: "saved" | "seen", minutesAgo = 0) {
  const source = media === "book" ? "openlibrary" : "tmdb";
  await query(
    `insert into title_states (user_id, media, source, external_id, ${set}, updated_at)
     values ($1, $2, $3, $4, true, now() - make_interval(mins => $5))
     on conflict (user_id, media, source, external_id) do update set ${set} = true, updated_at = excluded.updated_at`,
    [await ownerId(), media, source, String(id), minutesAgo],
  );
}

test("Seen & read lists everything you've watched, not only picks, and you can rate it there", async ({ page }) => {
  await page.goto("/movies");
  await page.getByRole("button", { name: /Deal 15 films/ }).click();
  await expect(page.getByText("1/15")).toBeVisible();
  const title = await page.getByRole("heading", { level: 2 }).first().textContent();
  await page.getByRole("button", { name: "Seen it", exact: true }).click();
  // Stars come up on the card; any other action moves on without a rating (and is not itself recorded).
  await expect(page.getByRole("group", { name: `Rate ${title!.trim()}` })).toBeVisible();
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await expect(page.getByText("2/15")).toBeVisible();
  await expect.poll(async () => (await query("select 1 from title_states where seen")).length).toBe(1);
  expect(await query("select 1 from title_actions where action = 'skipped'")).toEqual([]);

  await page.goto("/history");
  await expect(page.getByRole("link", { name: "Picks · 0" })).toBeVisible();
  await page.getByRole("link", { name: "Seen & read · 1" }).click();
  const list = flow(page, "Seen and read");
  await expect(list.getByRole("heading", { name: title!.trim(), exact: true })).toBeVisible();
  await list.getByRole("button", { name: "4 stars" }).click();
  await expect.poll(async () => (await query<{ rating: number }>("select rating from title_states where seen"))[0].rating).toBe(8);
});

test("Saved shows real totals, runs through every save in one flow, and keeps titles whose details didn't load", async ({ page }) => {
  // 30 real films and 60 ids the catalogue can't return: 90 saves, loaded 24 at a time.
  const real = [
    ...Array.from({ length: 20 }, (_, i) => 1000 + i),
    ...Array.from({ length: 5 }, (_, i) => 2000 + i),
    ...Array.from({ length: 5 }, (_, i) => 3000 + i),
  ];
  for (const [i, id] of real.entries()) await state("movie", id, "saved", 200 + i);
  for (let i = 0; i < 60; i++) await state("movie", 90000 + i, "saved", i);

  await page.goto("/saved");
  await expect(page.getByText(/Saved · 90 films/)).toBeVisible();
  // The newest are the ones that can't load: kept as placeholders, with the right source, while the
  // flow reads on to the first saves that do load.
  const unavailable = page.getByRole("list", { name: "Couldn't load" });
  await expect(unavailable.getByRole("listitem")).toHaveCount(60);
  await expect(unavailable.getByText(/didn't load from TMDb just now/).first()).toBeVisible();
  const saved = flow(page, "Saved titles");
  await expect(saved.getByRole("listitem")).toHaveCount(12);
  await expect(saved.getByText("1 of 30")).toBeVisible();
  // No page numbers: nearing the end of what's loaded brings the rest in.
  for (let i = 0; i < 8; i++) await saved.getByRole("button", { name: "Next" }).click();
  await expect(saved.getByRole("listitem")).toHaveCount(30);
  await expect(saved.getByText("9 of 30")).toBeVisible();
});

test("Pick from my saved looks at all your saves of that kind, however many newer ones there are", async ({ page }) => {
  // A book saved a day ago, behind 90 newer film saves.
  await state("book", 7000, "saved", 24 * 60);
  await page.goto("/saved");
  await page.getByRole("button", { name: "Pick from these" }).click();
  await page.getByRole("group", { name: "Pick a" }).getByRole("button", { name: "A book" }).click();
  await page.getByRole("group", { name: "Length" }).getByRole("button", { name: "Medium" }).click();
  await page.getByRole("button", { name: "Pick from my saved" }).click();
  await expect(page.getByText(/Read next/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Thriller Book 1" })).toBeVisible();
});

test("History: a pick you postponed can be marked watched right there, and in-progress titles link to where to watch", async ({ page }) => {
  const owner = await ownerId();
  // A film you picked, then said "Not yet" to: it went back to Saved.
  await query(
    `insert into pick_sessions (user_id, media, mood, energy, time, status, pick, follow_up, completed_at)
     values ($1, 'movie', 'gripping', 1, 1, 'picked', '{"source":"tmdb","externalId":"1003"}', 'later', now())`,
    [owner],
  );
  await state("movie", 1003, "saved");
  // The first test may have swiped this film "Seen it" (deck order varies): it's back to unwatched here.
  await query("update title_states set seen = false, rating = null where external_id = '1003' and media = 'movie'");
  await page.goto("/history");
  await expect(page.getByText("Not watched yet: it's in Saved.")).toBeVisible();
  await page.getByRole("button", { name: "Watched it" }).click();
  // Stars right there, then it's done.
  await page.getByRole("group", { name: "Rate English Thriller 4" }).getByRole("button", { name: "4 stars" }).click();
  await expect(page.getByText("Watched. It's in Seen & read.")).toBeVisible();
  await expect
    .poll(async () => (await query<{ seen: boolean; saved: boolean; rating: number }>("select seen, saved, rating from title_states where external_id = '1003'"))[0])
    .toEqual({ seen: true, saved: false, rating: 8 });

  // A series you're watching: where to watch it, beside Finished / Dropped.
  await query(
    `insert into title_states (user_id, media, source, external_id, picked_at, watching_since) values ($1, 'series', 'tmdb', '5001', now(), now())`,
    [owner],
  );
  await page.goto("/saved");
  await page.getByRole("region", { name: "Watching" }).getByRole("button", { name: "Check in: English Series 2" }).click();
  const sheet = page.getByRole("dialog", { name: "English Series 2" });
  await expect(sheet.getByRole("link", { name: /Where to watch/ })).toHaveAttribute("href", /English%20Series%202|English\+Series\+2/);

  // Not started yet: off Watching, back among your saves.
  await sheet.getByRole("button", { name: "Not started yet" }).click();
  await expect
    .poll(async () => (await query<{ saved: boolean; watching: boolean }>("select saved, watching_since is not null as watching from title_states where media = 'series' and external_id = '5001'"))[0])
    .toEqual({ saved: true, watching: false });
});

test("rating a title keeps your place in the flow: no reload, no jump back to the start", async ({ page }) => {
  for (let i = 0; i < 20; i++) await state("movie", 1000 + i, "seen", 10 + i);
  await page.goto("/history?tab=seen");
  const list = flow(page, "Seen and read");
  await bringToFront(list, "English Thriller 18");
  const target = list.getByRole("group", { name: "Your rating for English Thriller 18" });
  await target.scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => window.scrollY);
  await target.getByRole("button", { name: "4 stars" }).click();
  await expect(target.getByRole("button", { name: "4 stars" })).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(async () => (await query<{ rating: number }>("select rating from title_states where external_id = '1017'"))[0]?.rating)
    .toBe(8);
  await page.waitForTimeout(1000);
  await expect(list.getByRole("button", { name: "Show English Thriller 18" })).toHaveAttribute("aria-current", "true");
  expect(Math.abs((await page.evaluate(() => window.scrollY)) - before)).toBeLessThan(5);
});
