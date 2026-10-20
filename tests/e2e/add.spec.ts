import { expect, test } from "@playwright/test";
import { E2E_SETUP_TOKEN } from "../../playwright.config";
import { claimAccount, query, resetDatabase } from "./passkey";

test.describe.configure({ mode: "serial" });

const SESSION = "playwright/.cache/add-session.json";

test.beforeAll(async ({ browser }) => {
  await resetDatabase();
  const context = await browser.newContext({ storageState: undefined });
  const page = await context.newPage();
  await claimAccount(page, E2E_SETUP_TOKEN);
  await context.storageState({ path: SESSION });
  await context.close();
});

test.use({ storageState: SESSION });

const stateOf = async (media: string, id: string) =>
  (await query<{ seen: boolean; disliked: boolean; rating: number | null }>(
    "select seen, disliked, rating from title_states where media = $1 and external_id = $2",
    [media, id],
  ))[0];

test("Have you seen these?: stars mark it seen and rated, 'haven't seen' records nothing, 'not for me' turns it down", async ({ page }) => {
  await page.goto("/history");
  await page.getByRole("link", { name: /Add what you've already seen/ }).first().click();
  await expect(page.getByRole("heading", { name: "What you've already seen" })).toBeVisible();

  const card = () => page.getByRole("region").filter({ has: page.getByRole("group", { name: /^Rate / }) });
  const first = (await card().getByRole("heading", { level: 2 }).textContent())!.trim();
  await card().getByRole("button", { name: "4 stars" }).click();
  await expect(page.getByText("1 answered")).toBeVisible();

  const second = (await card().getByRole("heading", { level: 2 }).textContent())!.trim();
  expect(second).not.toBe(first);
  await card().getByRole("button", { name: "Haven't seen it" }).click();
  await expect(page.getByText("2 answered")).toBeVisible();
  await card().getByRole("button", { name: /Not for me/ }).click();
  await expect(page.getByText("3 answered")).toBeVisible();

  await expect.poll(async () => (await query("select 1 from title_states where seen and rating = 8")).length).toBe(1);
  await expect.poll(async () => (await query("select 1 from title_states where disliked")).length).toBe(1);
  // "Haven't seen it" leaves no trace.
  expect((await query("select 1 from title_states")).length).toBe(2);
});

test("search any title and mark it, and it shows in History under Seen & read", async ({ page }) => {
  await page.goto("/add");
  await page.getByRole("group", { name: "What" }).getByRole("button", { name: "Series" }).click();
  await page.getByRole("group", { name: "How" }).getByRole("button", { name: "Search" }).click();
  await page.getByRole("searchbox").fill("English Series 3");
  const row = page.getByRole("list", { name: "Search results" }).getByRole("listitem").filter({ hasText: "English Series 3" }).first();
  await row.getByRole("button", { name: /Seen it, no rating/ }).click();
  await expect(row.getByText("Seen", { exact: true })).toBeVisible();
  await expect.poll(async () => (await stateOf("series", "5002"))?.seen).toBe(true);

  await page.goto("/history?tab=seen");
  await expect(page.getByRole("list", { name: "Seen and read" }).getByRole("heading", { name: "English Series 3" })).toBeVisible();
});
