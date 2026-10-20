import { expect, test } from "@playwright/test";
import { E2E_SETUP_TOKEN } from "../../playwright.config";
import { claimAccount, query, resetDatabase } from "./passkey";

test.describe.configure({ mode: "serial" });

const SESSION = "playwright/.cache/polish-session.json";

test.beforeAll(async ({ browser }) => {
  await resetDatabase();
  const context = await browser.newContext({ storageState: undefined });
  const page = await context.newPage();
  await claimAccount(page, E2E_SETUP_TOKEN);
  await context.storageState({ path: SESSION });
  await context.close();
});

test.use({ storageState: SESSION });

test("cards say what their rating is out of", async ({ page }) => {
  await page.goto("/movies");
  await page.getByRole("button", { name: /Deal 15 films/ }).click();
  await expect(page.getByText("1/15")).toBeVisible();
  await expect(page.getByText(/\/10 · 2,500 votes/).first()).toBeVisible();
});

test("a deck that can't reach 15 says how many fit, and why", async ({ page }) => {
  // Dev Director (703) made 7 of the fake films.
  await page.goto("/movies?with=tmdb:703&name=Dev%20Director");
  await page.getByRole("button", { name: "Deal from Dev Director" }).click();
  await expect(page.getByText(/^1\/7$/)).toBeVisible();
  await expect(page.getByText(/Only 7 fit from Dev Director/)).toBeVisible();
});

test("a person page opened from a role keeps it", async ({ page }) => {
  await page.goto("/people/tmdb/703?as=actor");
  await expect(page.getByText(/Actor · also director/)).toBeVisible();
  await page.goto("/people/tmdb/703");
  await expect(page.getByText(/^Director ·/)).toBeVisible();
});

test("when nothing fits at all, it says so instead of 'nothing grabbed you'", async ({ page }) => {
  const owner = (await query<{ id: string }>('select id from "user" limit 1'))[0].id;
  // Every film in the fake catalogue is already seen.
  await query(
    `insert into title_states (user_id, media, source, external_id, seen)
     select $1, 'movie', 'tmdb', id::text, true
     from (select generate_series(1000, 1019) union all select generate_series(2000, 2004)
           union all select generate_series(3000, 3004) union all select generate_series(4000, 4004)) as ids(id)
     on conflict (user_id, media, source, external_id) do update set seen = true`,
    [owner],
  );
  await page.goto("/movies");
  await page.getByRole("button", { name: /Deal 15 films/ }).click();
  await expect(page.getByRole("heading", { name: "Nothing fits right now." })).toBeVisible();
  await expect(page.getByText("Nothing grabbed you.")).toHaveCount(0);
});
