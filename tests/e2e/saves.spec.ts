import { expect, test, type Page } from "@playwright/test";
import { E2E_SETUP_TOKEN } from "../../playwright.config";
import { claimAccount, query, resetDatabase } from "./passkey";

test.describe.configure({ mode: "serial" });

const SESSION = "playwright/.cache/saves-session.json";

test.beforeAll(async ({ browser }) => {
  await resetDatabase();
  const context = await browser.newContext({ storageState: undefined });
  const page = await context.newPage();
  await claimAccount(page, E2E_SETUP_TOKEN);
  await context.storageState({ path: SESSION });
  await context.close();
});

test.use({ storageState: SESSION });

const savedCount = async () => Number((await query<{ n: string }>("select count(*) as n from title_states where saved"))[0].n);

/** Makes every Server Action (the saves) fail on the server until undone. */
async function failSaves(page: Page) {
  await page.route("**/*", (route) =>
    route.request().method() === "POST" && route.request().headers()["next-action"]
      ? route.fulfill({ status: 500, body: "boom" })
      : route.continue(),
  );
}

test("a save that fails says so and can be retried; nothing is silently lost", async ({ page }) => {
  await page.goto("/movies");
  await page.getByRole("button", { name: /Deal 15 films/ }).click();
  await expect(page.getByText("1/15")).toBeVisible();

  await failSaves(page);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  // The deck carries on at once…
  await expect(page.getByText("2/15")).toBeVisible();
  // …and after the quiet retries, the failure is shown.
  await expect(page.getByRole("alert").filter({ hasText: "didn't save" })).toBeVisible({ timeout: 10_000 });
  expect(await savedCount()).toBe(0);

  await page.unroute("**/*");
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "didn't save" })).toHaveCount(0);
  await expect.poll(savedCount).toBe(1);
});

test("the pick screen says when the pick is saved", async ({ page }) => {
  await page.goto("/movies");
  await page.getByRole("button", { name: /Deal 15 films/ }).click();
  await expect(page.getByText("1/15")).toBeVisible();
  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Save", exact: true }).click();
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: /^Choose / }).first().click();
  await expect(page.getByText(/Tonight's pick/)).toBeVisible();
  await expect(page.getByText("Saved to your History")).toBeVisible();
  await expect
    .poll(async () => (await query<{ status: string }>("select status from pick_sessions order by created_at desc limit 1"))[0].status)
    .toBe("picked");
});
