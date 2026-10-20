import { expect, test } from "@playwright/test";
import { E2E_SETUP_TOKEN } from "../../playwright.config";
import { claimAccount, query, resetDatabase } from "./passkey";

test.describe.configure({ mode: "serial" });

const SESSION = "playwright/.cache/resume-session.json";

test.beforeAll(async ({ browser }) => {
  await resetDatabase();
  const context = await browser.newContext({ storageState: undefined });
  const page = await context.newPage();
  await claimAccount(page, E2E_SETUP_TOKEN);
  await context.storageState({ path: SESSION });
  await context.close();
});

test.use({ storageState: SESSION });

const swipesLogged = async () => (await query("select 1 from title_actions where pick_session_id is not null")).length;

test("a reload mid-deck offers to resume it, right where you were", async ({ page }) => {
  await page.goto("/movies");
  await page.getByRole("button", { name: /Deal 15 films/ }).click();
  await expect(page.getByText("1/15")).toBeVisible();
  const first = (await page.getByRole("heading", { level: 2 }).first().textContent())!;
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("4/15")).toBeVisible();
  await expect.poll(swipesLogged).toBe(3);

  await page.reload();
  const offer = page.getByRole("region", { name: "Unfinished deck" });
  await expect(offer.getByText("Gripping films · card 4 of 15 · 2 saved")).toBeVisible();
  await offer.getByRole("button", { name: "Resume" }).click();
  await expect(page.getByText("4/15")).toBeVisible();
  await expect(page.getByRole("list", { name: "2 of 4 saved" })).toBeVisible();
  // The first card is behind you, not dealt again.
  await expect(page.getByRole("heading", { level: 2, name: first.trim(), exact: true })).toHaveCount(0);
});

test("Start again forgets the unfinished deck", async ({ page }) => {
  await page.goto("/movies");
  const offer = page.getByRole("region", { name: "Unfinished deck" });
  await offer.getByRole("button", { name: "Start again" }).click();
  await expect(offer).toHaveCount(0);
  await expect
    .poll(async () => (await query<{ status: string }>("select status from pick_sessions order by created_at desc limit 1"))[0].status)
    .toBe("abandoned");
  await page.reload();
  await expect(page.getByRole("heading", { name: "What kind of night is it?" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Unfinished deck" })).toHaveCount(0);
});
