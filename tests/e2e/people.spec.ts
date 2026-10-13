import { expect, test } from "@playwright/test";
import { E2E_SETUP_TOKEN } from "../../playwright.config";
import { claimAccount, query, resetDatabase } from "./passkey";

test.describe.configure({ mode: "serial" });

const SESSION = "playwright/.cache/people-session.json";

test.beforeAll(async ({ browser }) => {
  await resetDatabase();
  const context = await browser.newContext({ storageState: undefined });
  const page = await context.newPage();
  await claimAccount(page, E2E_SETUP_TOKEN);
  await context.storageState({ path: SESSION });
  await context.close();
});

test.use({ storageState: SESSION });

/** In the fake TMDb, film N is directed by director 700 + N % 5. */
const directedBy = (id: number, director: number) => id % 5 === director - 700;
const lastDeck = async () =>
  (await query<{ deck: { externalId: string }[] }>("select deck from pick_sessions order by created_at desc limit 1"))[0].deck.map(
    (e) => Number(e.externalId),
  );

test("tap a name on a card to follow them; their films then rank first, with a badge", async ({ page }) => {
  await page.goto("/movies");
  await page.getByRole("button", { name: /Deal 15 films/ }).click();
  await expect(page.getByText("1/15")).toBeVisible();

  // The sheet: follow without leaving the deck. (Every fake film has "Lead Actor".)
  await page.getByRole("button", { name: "Lead Actor" }).first().click();
  const sheet = page.getByRole("dialog", { name: "Lead Actor" });
  await expect(sheet.getByRole("link", { name: /See all their work/ })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
  await expect(page.getByText("1/15")).toBeVisible();

  await page.goto("/people/tmdb/701");
  await expect(page.getByRole("heading", { name: "Ben Director" })).toBeVisible();
  await page.getByRole("button", { name: "Follow", exact: true }).click();
  await expect(page.getByRole("button", { name: "✓ Following" })).toBeVisible();
  await expect
    .poll(async () => (await query<{ kind: string }>("select kind from people_prefs where person_id = '701'"))[0]?.kind)
    .toBe("follow");

  await page.goto("/movies");
  await page.getByRole("button", { name: /Deal 15 films/ }).click();
  await expect(page.getByText(/^1\/\d+$/)).toBeVisible();
  // His best two films are dealt (two per followed person, four in all), with a badge.
  const deck = await lastDeck();
  expect(deck.filter((id) => directedBy(id, 701))).toHaveLength(2);
  const first = deck.findIndex((id) => directedBy(id, 701));
  for (let i = 0; i < first; i++) await page.getByRole("button", { name: "Skip", exact: true }).click();
  await expect(page.getByText(`${first + 1}/${deck.length}`)).toBeVisible();
  await expect(page.getByText("You follow Ben Director")).toBeVisible();
});

test("avoid someone and their work never comes up", async ({ page }) => {
  await page.goto("/people/tmdb/700");
  await expect(page.getByRole("heading", { name: "Ava Director" })).toBeVisible();
  await page.getByRole("button", { name: "Avoid", exact: true }).click();
  await expect(page.getByRole("button", { name: "Avoided" })).toBeVisible();
  await expect
    .poll(async () => (await query<{ kind: string }>("select kind from people_prefs where person_id = '700'"))[0]?.kind)
    .toBe("avoid");

  await page.goto("/movies");
  await page.getByRole("button", { name: /Deal 15 films/ }).click();
  await expect(page.getByText(/^1\/\d+$/)).toBeVisible();
  const deck = await lastDeck();
  expect(deck.length).toBeGreaterThan(0);
  expect(deck.filter((id) => directedBy(id, 700))).toEqual([]);
});

test("deal from a person: from their page, and from the start screen's search", async ({ page }) => {
  await page.goto("/people/tmdb/703");
  await page.getByRole("link", { name: /Deal from Dev Director/ }).click();
  await expect(page.getByRole("button", { name: "Deal from Dev Director" })).toBeVisible();
  await page.getByRole("button", { name: "Deal from Dev Director" }).click();
  await expect(page.getByText("From Dev Director", { exact: true }).first()).toBeVisible();
  const fromPage = await lastDeck();
  expect(fromPage.length).toBeGreaterThan(0);
  expect(fromPage.every((id) => directedBy(id, 703))).toBe(true);

  await page.goto("/movies");
  await page.getByLabel(/With someone in mind/).fill("cara");
  await page.getByRole("button", { name: /Cara Director/ }).click();
  await page.getByRole("button", { name: "Deal from Cara Director" }).click();
  await expect(page.getByText("From Cara Director", { exact: true }).first()).toBeVisible();
  const fromSearch = await lastDeck();
  expect(fromSearch.every((id) => directedBy(id, 702))).toBe(true);
});

test("People in Saved: following with Deal, suggestions from what you love, and undo an avoid", async ({ page }) => {
  // Love three films by Eli Director (saved from his page).
  await page.goto("/people/tmdb/704");
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Save", exact: true }).first().click();
  await expect.poll(async () => (await query<{ n: string }>("select count(*) as n from title_states where saved"))[0].n).toBe("3");

  await page.goto("/saved");
  const people = page.locator("#people");
  await expect(people.getByText("Following · 1")).toBeVisible();
  await expect(people.getByRole("link", { name: /Ben Director/ })).toBeVisible();
  await expect(people.getByRole("link", { name: "Deal →" })).toHaveAttribute("href", /\/movies\?with=tmdb:701&name=Ben%20Director/);

  await expect(people.getByText(/You've loved 3 titles with/).filter({ hasText: "Eli Director" })).toBeVisible();
  const eli = people.getByRole("listitem").filter({ hasText: "Eli Director" });
  await eli.getByRole("button", { name: "Not now" }).click();
  await expect(people.getByRole("listitem").filter({ hasText: /loved 3 titles with\s*Eli Director/ })).toHaveCount(0);
  expect((await query<{ kind: string }>("select kind from people_prefs where person_id = '704'"))[0].kind).toBe("dismissed");

  await expect(people.getByText("Avoided · 1")).toBeVisible();
  await people.getByRole("button", { name: "Undo" }).click();
  await expect(people.getByText("Avoided · 1")).toHaveCount(0);
  expect(await query("select 1 from people_prefs where person_id = '700'")).toEqual([]);
});

test("books by author: search an author and deal only their books", async ({ page }) => {
  await page.goto("/books");
  await page.getByLabel(/An author in mind/).fill("Author 3");
  await page.getByRole("button", { name: /^Author 3 /, exact: false }).click();
  await page.getByRole("button", { name: "Deal from Author 3" }).click();
  await expect(page.getByText("From Author 3", { exact: true }).first()).toBeVisible();
  expect(await lastDeck()).toEqual([7002]);
});
