import { expect, type Locator, type Page } from "@playwright/test";

/** A cover flow by its label ("Saved titles"): the posters, and what's under the one in front. */
export const flow = (page: Page, label: string | RegExp) => page.getByRole("region", { name: label });

/**
 * Bring a title to the front of a cover flow with its arrows, as you would,
 * so what's under it (its buttons) shows.
 */
export async function bringToFront(region: Locator, title: string | RegExp) {
  const posters = region.getByRole("listitem").getByRole("button");
  await expect(posters.first()).toBeVisible();
  const names = await posters.evaluateAll((els) => els.map((el) => (el.getAttribute("aria-label") ?? "").replace(/^Show /, "")));
  const target = names.findIndex((n) => (typeof title === "string" ? n === title : title.test(n)));
  if (target < 0) throw new Error(`${title} isn't in this flow (${names.join(", ")})`);
  const current = await posters.evaluateAll((els) => els.findIndex((el) => el.getAttribute("aria-current") === "true"));
  const arrow = region.getByRole("button", { name: target > current ? "Next" : "Previous" });
  for (let i = 0; i < Math.abs(target - current); i++) await arrow.click();
  await expect(posters.nth(target)).toHaveAttribute("aria-current", "true");
}
