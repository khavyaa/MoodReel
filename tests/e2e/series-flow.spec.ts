import { expect, test } from "@playwright/test";
import { E2E_SETUP_TOKEN } from "../../playwright.config";
import { claimAccount, query, resetDatabase } from "./passkey";
import { flow } from "./flow";

test.describe.configure({ mode: "serial" });

const SESSION = "playwright/.cache/series-flow-session.json";

test.beforeAll(async ({ browser }) => {
  await resetDatabase();
  const context = await browser.newContext({ storageState: undefined });
  const page = await context.newPage();
  await claimAccount(page, E2E_SETUP_TOKEN);
  await context.storageState({ path: SESSION });
  await context.close();
});

test.use({ storageState: SESSION });

test("series: taps → deck → head-to-head → a pick that goes on your Watching list", async ({ page }) => {
  await page.goto("/series");
  await expect(page.getByRole("heading", { name: "What are you settling into?" })).toBeVisible();
  await expect(page.getByText("Commitment", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Romantic" })).toHaveCount(0); // no TV romance genre
  await page.getByRole("button", { name: "Gripping" }).click();
  await page.getByRole("button", { name: "One season" }).click();
  await page.getByRole("button", { name: /Deal 15 series/ }).click();

  // The card shows series facts.
  await expect(page.getByText("1/15")).toBeVisible();
  await expect(page.getByText(/· \d seasons? · 45-min episodes/).first()).toBeVisible();

  // Animation and a Hindi daily soap are never dealt; about one in four is Hindi.
  const [session] = await query<{ deck: { externalId: string }[]; media: string }>(
    "select deck, media from pick_sessions order by created_at desc limit 1",
  );
  expect(session.media).toBe("series");
  const dealt = session.deck.map((e) => Number(e.externalId));
  expect(dealt).toHaveLength(15);
  expect(dealt).not.toContain(5900);
  expect(dealt).not.toContain(6900);
  expect(dealt.filter((id) => id >= 6000).length).toBe(4);

  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("heading", { name: "This or that?" })).toBeVisible();
  for (let round = 1; round <= 3; round++) await page.getByRole("button", { name: /^Choose / }).first().click();

  await expect(page.getByText(/Tonight's pick · Gripping/)).toBeVisible();
  await expect(page.getByText("Start with Season 1")).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "On your Watching list" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Where to watch/ })).toHaveAttribute("href", /series%20where%20to%20watch/);

  await expect
    .poll(async () => (await query<{ n: string }>("select count(*) as n from title_states where media = 'series' and watching_since is not null"))[0].n)
    .toBe("1");
  const [{ saved }] = await query<{ saved: string }>("select count(*) as saved from title_states where media = 'series' and saved");
  expect(saved).toBe("3");
});

test("Saved shows Watching on top, and a few days later the series screen asks how it's going", async ({ page }) => {
  const [{ title }] = await query<{ title: string }>(
    "select external_id as title from title_states where media = 'series' and watching_since is not null",
  );
  const watchingId = Number(title);

  await page.goto("/saved");
  await expect(page.getByRole("region", { name: "Watching" }).getByText(/Watching · 1/)).toBeVisible();
  await expect(page.getByText("Saved · 3 series")).toBeVisible();

  // Nothing to ask yet; then it's been four days.
  await page.goto("/series");
  await expect(page.getByText(/^Still watching .+\?$/)).toHaveCount(0);
  await query("update title_states set watching_since = now() - interval '4 days' where media = 'series' and watching_since is not null");
  await page.goto("/series");
  await expect(page.getByText(/^Still watching .+\?$/)).toBeVisible();

  // Still watching: asked again in a few days, not now.
  await page.getByRole("button", { name: "Still watching" }).click();
  await expect(page.getByText(/We'll ask again in a few days/)).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "What are you settling into?" })).toBeVisible();
  await expect(page.getByText(/^Still watching .+\?$/)).toHaveCount(0);

  // Four more days, then finished with four stars.
  await query("update title_states set checked_in_at = now() - interval '4 days' where media = 'series'");
  await page.goto("/series");
  await page.getByRole("button", { name: "Finished it" }).click();
  await page.getByRole("button", { name: "4 stars" }).click();
  await expect(page.getByText(/is in your history/)).toBeVisible();
  await expect
    .poll(async () =>
      (await query<{ seen: boolean; rating: number; watching: boolean }>(
        `select seen, rating, watching_since is not null as watching from title_states where media = 'series' and external_id = '${watchingId}'`,
      ))[0],
    )
    .toEqual({ seen: true, rating: 8, watching: false });
  const [{ n }] = await query<{ n: string }>("select count(*) as n from title_actions where action = 'finished'");
  expect(n).toBe("1");
});

test("pick a series from Saved, drop it, and History tells them apart", async ({ page }) => {
  await page.goto("/saved");
  await page.getByRole("button", { name: "Pick from these" }).click();
  await page.getByRole("button", { name: "Pick from my saved" }).click();
  await expect(page.getByText(/From your saved list · Round 1 of 2/)).toBeVisible();
  await page.getByRole("button", { name: /^Choose / }).first().click();
  await page.getByRole("button", { name: /^Choose / }).first().click();
  await expect(page.getByText(/Tonight's pick/)).toBeVisible();
  await expect
    .poll(async () => (await query<{ n: string }>("select count(*) as n from title_states where media = 'series' and watching_since is not null"))[0].n)
    .toBe("1");

  await page.goto("/saved");
  await page.getByRole("region", { name: "Watching" }).getByRole("button", { name: /^Check in: / }).click();
  await page.getByRole("button", { name: "Dropped it" }).click();
  await expect
    .poll(async () => (await query<{ n: string }>("select count(*) as n from title_states where media = 'series' and disliked"))[0].n)
    .toBe("1");

  await page.goto("/history");
  await expect(page.getByText("History · 2 picks")).toBeVisible();
  // Newest first: the one you dropped, then the one you finished.
  const picks = flow(page, "Your picks");
  await expect(picks.getByText("You dropped this one.")).toBeVisible();
  await picks.getByRole("button", { name: "Next" }).click();
  await expect(picks.getByRole("button", { name: "4 stars" })).toHaveAttribute("aria-pressed", "true");

  // Neither comes back in a new deck.
  await page.goto("/series");
  await page.getByRole("button", { name: /Deal 15 series/ }).click();
  await expect(page.getByText("1/15")).toBeVisible();
  const handled = (await query<{ id: string }>("select external_id as id from title_states where media = 'series' and (seen or disliked)")).map((r) => r.id);
  const [latest] = await query<{ deck: { externalId: string }[] }>("select deck from pick_sessions order by created_at desc limit 1");
  expect(latest.deck.map((e) => e.externalId).filter((id) => handled.includes(id))).toEqual([]);
});
