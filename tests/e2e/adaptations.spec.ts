import { expect, test } from "@playwright/test";
import { flow } from "./flow";
import { E2E_SETUP_TOKEN } from "../../playwright.config";
import { claimAccount, query, resetDatabase } from "./passkey";

test.describe.configure({ mode: "serial" });

const SESSION = "playwright/.cache/adaptations-session.json";

// In the fake data: book 7000 ("Thriller Book 1") became film 1003, book 7001 ("Thriller Book 2") film 1007.
// Films 1015–1019 and 2004 are tagged "based on a book" by TMDb; 1018's credits name "Author 9".
const LINKS = [
  [7000, 1003],
  [7001, 1007],
];
const TAGGED = [1015, 1016, 1017, 1018, 1019, 2004];

test.beforeAll(async ({ browser }) => {
  await resetDatabase();
  await query("delete from adaptations");
  for (const [book, film] of LINKS) {
    await query(`insert into adaptations (book_id, media, screen_id, via, checked) values (${book}, 'movie', ${film}, 'wikidata', true)`);
  }
  const context = await browser.newContext({ storageState: undefined });
  const page = await context.newPage();
  await claimAccount(page, E2E_SETUP_TOKEN);
  await context.storageState({ path: SESSION });
  await context.close();
});

// Links are shared reference data, not per user: leave none behind for other specs.
test.afterAll(async () => {
  await query("delete from adaptations");
});

test.use({ storageState: SESSION });

const lastDeck = async () =>
  (await query<{ deck: { externalId: string }[] }>("select deck from pick_sessions order by created_at desc limit 1"))[0].deck.map(
    (e) => Number(e.externalId),
  );
const ownerId = async () => (await query<{ id: string }>('select id from "user" limit 1'))[0].id;

test("a film of a book you've read ranks first, with a badge and the book on its card", async ({ page }) => {
  // You've read Thriller Book 1 (a Read it swipe on it).
  await query(
    `insert into title_states (user_id, media, source, external_id, seen) values ('${await ownerId()}', 'book', 'openlibrary', '7000', true)`,
  );
  await page.goto("/movies");
  await page.getByRole("button", { name: /Deal 15 films/ }).click();
  await expect(page.getByText(/^1\/\d+$/)).toBeVisible();

  // Every fake English film scores the same, so only the boost puts this one first.
  expect((await lastDeck())[0]).toBe(1003);
  await expect(page.getByText("You've read the book")).toBeVisible();
  await expect(page.getByText("Based on the book")).toBeVisible();
  await expect(page.getByText(/^Thriller Book 1 · Author 1, 2018$/)).toBeVisible();
});

test("adaptations only: every film dealt is based on a book, and credits fill in a missing link", async ({ page }) => {
  await page.goto("/movies");
  await page.getByRole("switch", { name: /Adaptations only/ }).click();
  await expect(page.getByRole("switch", { name: /Adaptations only/ })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Deal 15 adaptations" }).click();
  await expect(page.getByText(/^1\/\d+$/)).toBeVisible();

  const deck = await lastDeck();
  const allowed = new Set([...LINKS.map(([, film]) => film), ...TAGGED]);
  expect(deck.length).toBeGreaterThan(0);
  expect(deck.filter((id) => !allowed.has(id))).toEqual([]);
  // 1018 had no link; its "Novel" credit found the book on Open Library and kept it.
  expect(deck).toContain(1018);
  await expect
    .poll(async () => (await query<{ book_id: number; via: string }>("select book_id, via from adaptations where screen_id = 1018"))[0])
    .toEqual({ book_id: 7008, via: "credits" });
});

test("Saved shows the link, and the pick screen offers \"I've read it\" for the book", async ({ page }) => {
  // One saved film, from a book you haven't read: picking from Saved makes it tonight's pick.
  await query(
    `insert into title_states (user_id, media, source, external_id, saved) values ('${await ownerId()}', 'movie', 'tmdb', '1007', true)`,
  );
  await page.goto("/saved");
  const saved = flow(page, "Saved titles");
  await expect(saved.getByText("Also a book · Author 2")).toBeVisible();

  await page.getByRole("button", { name: "Pick from my saved" }).click();
  await expect(page.getByText(/Tonight's pick/)).toBeVisible();
  await expect(page.getByText("Based on the book")).toBeVisible();
  await page.getByRole("button", { name: "I've read it" }).click();
  await expect(page.getByText("Read it", { exact: true })).toBeVisible();
  await expect
    .poll(async () => (await query<{ seen: boolean }>("select seen from title_states where media = 'book' and external_id = '7001'"))[0]?.seen)
    .toBe(true);

  await page.goto("/history");
  await expect(page.getByText("Book: read it")).toBeVisible();
});
