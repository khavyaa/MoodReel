import { expect, test } from "@playwright/test";
import { E2E_SETUP_TOKEN } from "../../playwright.config";
import { claimAccount, query, resetDatabase } from "./passkey";
import { flow } from "./flow";

test.describe.configure({ mode: "serial" });

const SESSION = "playwright/.cache/lists-session.json";

// In the fake Wikidata, Best Picture went to films 1001 (2020), 1006 (2019) and 2002 (2018).
test.beforeAll(async ({ browser }) => {
  await resetDatabase();
  await query("delete from list_items; delete from list_follows;");
  const context = await browser.newContext({ storageState: undefined });
  const page = await context.newPage();
  await claimAccount(page, E2E_SETUP_TOKEN);
  await context.storageState({ path: SESSION });
  await context.close();
});

test.afterAll(async () => {
  await query("delete from list_items");
});

test.use({ storageState: SESSION });

const lastDeck = async () =>
  (await query<{ deck: { externalId: string }[] }>("select deck from pick_sessions order by created_at desc limit 1"))[0].deck.map(
    (e) => Number(e.externalId),
  );

test("a list fills itself, shows your progress, and you can mark titles seen and follow it", async ({ page }) => {
  await page.goto("/movies");
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Lists" }).first().click();
  await expect(page.getByRole("heading", { name: "Worth getting through" })).toBeVisible();
  await page.getByRole("link", { name: /Oscar Best Picture winners/ }).click();

  const titles = flow(page, "Titles on this list");
  await expect(titles.getByRole("listitem")).toHaveCount(3);
  // Newest win in front, its year on the poster.
  await expect(titles.getByRole("listitem").first()).toContainText("Won 2020");
  await expect(page.getByRole("progressbar", { name: "0 of 3 seen" })).toBeVisible();

  // Seen it asks for stars; rating moves the flow on to the next title.
  await titles.getByRole("button", { name: "Seen it" }).click();
  await titles.getByRole("button", { name: "4 stars" }).click();
  await expect(titles.getByText("2 of 3")).toBeVisible();
  await expect
    .poll(async () => (await query<{ rating: number }>("select rating from title_states where seen and media = 'movie'"))[0]?.rating)
    .toBe(8);
  await page.getByRole("button", { name: "Follow" }).click();
  await expect(page.getByRole("button", { name: "Following" })).toBeVisible();
  await expect.poll(async () => (await query("select 1 from list_follows")).length).toBe(1);

  await page.reload();
  await expect(page.getByRole("progressbar", { name: "1 of 3 seen" })).toBeVisible();
});

test("a followed list's titles get a badge in your normal decks", async ({ page }) => {
  await page.goto("/movies");
  await page.getByRole("button", { name: /Deal 15 films/ }).click();
  await expect(page.getByText(/^1\/\d+$/)).toBeVisible();
  const deck = await lastDeck();
  const at = deck.findIndex((id) => id === 1006 || id === 2002);
  expect(at).toBeGreaterThanOrEqual(0);
  for (let i = 0; i < at; i++) await page.getByRole("button", { name: "Skip", exact: true }).click();
  await expect(page.getByText("On Oscar Best Picture")).toBeVisible();
});

test("deal from a list: only its titles you haven't seen", async ({ page }) => {
  await page.goto("/lists/oscar-best-picture");
  await page.getByRole("link", { name: /Deal from this list/ }).click();
  await page.getByRole("button", { name: "Deal from Oscar Best Picture winners" }).click();
  await expect(page.getByText("From Oscar Best Picture winners", { exact: true }).first()).toBeVisible();
  const deck = await lastDeck();
  expect(deck.length).toBeGreaterThan(0);
  // 1001 is seen; 1006 was skipped in the last test, so only 2002 is left.
  expect(deck.every((id) => id === 2002 || id === 1006)).toBe(true);
  expect(deck).not.toContain(1001);
});

test("a list still keeps a mood's hard rules: no thrillers in a Funny deal", async ({ page }) => {
  // Every fake film on the list is a thriller.
  await page.goto("/movies?list=oscar-best-picture&name=Oscar%20Best%20Picture%20winners");
  await page.getByRole("button", { name: /^Funny/ }).click();
  await page.getByRole("button", { name: "Deal from Oscar Best Picture winners" }).click();
  await expect(page.getByText("Nothing left from Oscar Best Picture winners.")).toBeVisible();
});

test("find a film collection and browse it in order", async ({ page }) => {
  await page.goto("/lists");
  await page.getByRole("searchbox").fill("thriller");
  await page.getByRole("list", { name: "Collections found" }).getByRole("link", { name: "Thriller Trilogy" }).click();
  await expect(page.getByRole("heading", { name: "Thriller Trilogy" })).toBeVisible();
  const titles = flow(page, "Titles on this list");
  await expect(titles.getByRole("listitem")).toHaveCount(3);
  await expect(titles.getByRole("listitem").first()).toContainText("Part 1");
});
