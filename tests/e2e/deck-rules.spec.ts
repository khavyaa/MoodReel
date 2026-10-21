import { expect, test } from "@playwright/test";
import { E2E_SETUP_TOKEN } from "../../playwright.config";
import { claimAccount, query, resetDatabase } from "./passkey";

test.describe.configure({ mode: "serial" });

const SESSION = "playwright/.cache/deck-rules-session.json";

test.beforeAll(async ({ browser }) => {
  await resetDatabase();
  const context = await browser.newContext({ storageState: undefined });
  const page = await context.newPage();
  await claimAccount(page, E2E_SETUP_TOKEN);
  await context.storageState({ path: SESSION });
  await context.close();
});

test.use({ storageState: SESSION });

const lastDeck = async () =>
  (await query<{ deck: { externalId: string }[] }>("select deck from pick_sessions order by created_at desc limit 1"))[0].deck.map(
    (e) => Number(e.externalId),
  );
const ownerId = async () => (await query<{ id: string }>('select id from "user" limit 1'))[0].id;

// In the fake TMDb, film N is directed by 700 + N % 5; film 1004 is Eli Director's (704) best, and runs 182 minutes.
test("a followed director's three-hour film stays out of an 'around 2 hours' deck", async ({ page }) => {
  const owner = await ownerId();
  await query(
    `insert into people_prefs (user_id, source, person_id, name, role, kind) values ('${owner}', 'tmdb', '704', 'Eli Director', 'director', 'follow')`,
  );
  // You've seen his other films, so the follow boost can only go to the long one.
  for (const id of [1009, 1014, 1019, 2004, 3004, 4004]) {
    await query(
      `insert into title_states (user_id, media, source, external_id, seen) values ('${owner}', 'movie', 'tmdb', '${id}', true)`,
    );
  }
  await page.goto("/movies");
  await page.getByRole("button", { name: "Around 2 hours" }).click();
  await page.getByRole("button", { name: /Deal 15 films/ }).click();
  await expect(page.getByText(/^1\/\d+$/)).toBeVisible();
  const deck = await lastDeck();
  expect(deck.length).toBeGreaterThan(0);
  expect(deck).not.toContain(1004);
});

test("deal from someone with a long career: once their best-known titles are seen, the rest still come up", async ({ page }) => {
  // Lead Actor (780) is in all 35 rule-passing fake films. You've seen all but one, Malayalam Mystery 4
  // (3003): among his least known, beyond the 24 their page lists. (The test above already saw 3004.)
  const owner = await ownerId();
  const all = [
    ...Array.from({ length: 20 }, (_, i) => 1000 + i),
    ...Array.from({ length: 5 }, (_, i) => 2000 + i),
    ...Array.from({ length: 5 }, (_, i) => 3000 + i),
    ...Array.from({ length: 5 }, (_, i) => 4000 + i),
  ];
  const seen = all.filter((id) => id !== 3003);
  for (const id of seen) {
    await query(
      `insert into title_states (user_id, media, source, external_id, seen) values ('${owner}', 'movie', 'tmdb', '${id}', true)
       on conflict (user_id, media, source, external_id) do update set seen = true`,
    );
  }
  await page.goto("/people/tmdb/780");
  // Every one of their films is on the page now, in one flow, loaded 24 at a time.
  await expect(page.getByRole("region", { name: /films/ }).getByText(/^1 of 3\d\b/)).toBeVisible();
  await page.getByRole("link", { name: /Deal from Lead Actor/ }).click();
  await page.getByRole("button", { name: "Deal from Lead Actor" }).click();
  await expect(page.getByText("From Lead Actor", { exact: true }).first()).toBeVisible();
  expect(await lastDeck()).toEqual([3003]);
});
