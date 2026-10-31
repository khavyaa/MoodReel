import { expect, test } from "@playwright/test";
import { E2E_SETUP_TOKEN } from "../../playwright.config";
import { addVirtualAuthenticator, resetDatabase } from "./passkey";

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await resetDatabase();
});

test("first run: claim the account with the setup token and a passkey, then sign out and back in", async ({
  page,
  isMobile,
}) => {
  await addVirtualAuthenticator(page);

  // Signed out, every app page sends you to sign-in.
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fsettings$/);

  // Setup: a wrong token is refused…
  await page.goto("/setup");
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await page.getByLabel("Setup token").fill("not-the-token");
  await page.getByRole("button", { name: "Continue" }).click();
  // Filter by text: Next.js also renders an empty role="alert" route announcer.
  await expect(page.getByRole("alert").filter({ hasText: "doesn't match" })).toBeVisible();

  // …the right one unlocks the passkey step, and saving it signs you in.
  await page.getByLabel("Setup token").fill(E2E_SETUP_TOKEN);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Save a passkey" }).click();
  await expect(page).toHaveURL(/\/movies$/);
  await expect(page.getByRole("heading", { name: /What kind of night is it\?/i })).toBeVisible();

  // The shell adapts: header navigation on a laptop, bottom bar on a phone.
  const mainNavs = page.getByRole("navigation", { name: "Main" });
  if (isMobile) {
    await expect(mainNavs.filter({ visible: true })).toHaveCount(1);
    await expect(page.locator("nav.fixed")).toBeVisible();
  } else {
    await expect(page.locator("nav.fixed")).toBeHidden();
  }

  // Settings lists the passkey and keeps the look override on this device.
  await page.goto("/settings");
  await expect(page.getByText(/Added .* · /)).toBeVisible();
  await page.getByRole("radio", { name: /Cinematic dark/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-look", "cinematic");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-look", "cinematic");
  await page.getByRole("radio", { name: /Match this device/ }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-look", /.+/);

  // Sign out, confirm the app is locked, then sign back in with the passkey.
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.goto("/saved");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fsaved$/);
  await page.getByRole("button", { name: "Sign in with your passkey" }).click();
  await expect(page).toHaveURL(/\/saved$/);
  await expect(page.getByRole("heading", { name: "Nothing saved yet" })).toBeVisible();
});

test("once claimed, setup can only add a passkey to the same account", async ({ page }) => {
  await page.goto("/setup");
  await expect(page.getByRole("heading", { name: "Add a passkey" })).toBeVisible();
});

test("the page never scrolls sideways", async ({ page }) => {
  for (const path of ["/", "/sign-in", "/setup", "/about"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});
