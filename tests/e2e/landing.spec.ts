import { expect, test } from "@playwright/test";
import { E2E_SETUP_TOKEN } from "../../playwright.config";
import { claimAccount, resetDatabase } from "./passkey";
import { flow } from "./flow";

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await resetDatabase();
});

test("the landing page: one screen, the story as a cover flow that turns by itself", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /three taps, one pick/i })).toBeAttached();
  const story = flow(page, "What MoodReel does");
  await expect(story.getByRole("listitem")).toHaveCount(7);
  await expect(story.getByText("Films, series and books for the mood you're in.")).toBeVisible();

  // Nothing to scroll, on a laptop or a phone, and nothing cut off either: the front card and signing in are all on screen.
  expect(await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)).toBeLessThanOrEqual(1);
  await expect(story.getByRole("button", { name: "Show Three taps. One pick." })).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole("button", { name: "Sign in with your passkey" })).toBeInViewport({ ratio: 1 });
  // A short screen (a small iPhone, a squat window): the cards shrink to fit rather than being cut off.
  const size = page.viewportSize()!;
  await page.setViewportSize({ width: size.width, height: 600 });
  await expect(story.getByRole("button", { name: "Show Three taps. One pick." })).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole("button", { name: "Sign in with your passkey" })).toBeInViewport({ ratio: 1 });
  await page.setViewportSize(size);

  // It turns by itself…
  await expect(story.getByText("Seven moods, an energy, and the time you have.")).toBeVisible({ timeout: 7000 });
  // …and the arrows take you anywhere.
  await story.getByRole("button", { name: "Next" }).click();
  await expect(story.getByText("Fifteen titles that fit, not a wall of them.")).toBeVisible();

  // The app's own front door leads here; anything deeper still goes to sign-in.
  await page.goto("/movies");
  await expect(page).toHaveURL(/\/$/);
});

test("sign in from the landing page with your passkey; signed in, the front door is the films start screen", async ({ page, context }) => {
  await claimAccount(page, E2E_SETUP_TOKEN);
  await context.clearCookies();
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in with your passkey" }).click();
  await expect(page).toHaveURL(/\/movies$/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/movies$/);
});
