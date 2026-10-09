import { expect, test, type Page } from "@playwright/test";
import { E2E_SETUP_TOKEN } from "../../playwright.config";
import { claimAccount, query, resetDatabase } from "./passkey";

test.describe.configure({ mode: "serial" });

// Claim the account once per run, then share the signed-in session across tests
// (each test otherwise gets a fresh, signed-out browser).
const SESSION = "playwright/.cache/movie-flow-session.json";

test.beforeAll(async ({ browser }) => {
  await resetDatabase();
  // Explicitly start signed out: the file-level storageState doesn't exist yet.
  const context = await browser.newContext({ storageState: undefined });
  const page = await context.newPage();
  await claimAccount(page, E2E_SETUP_TOKEN);
  await context.storageState({ path: SESSION });
  await context.close();
});

test.use({ storageState: SESSION });

async function currentTitle(page: Page) {
  return (await page.locator("h2").first().textContent())?.trim() ?? "";
}

test("taps → deck → head-to-head → tonight's pick, saved to the database", async ({ page }) => {
  await page.goto("/movies");

  // Taps
  await expect(page.getByRole("heading", { name: "What kind of night is it?" })).toBeVisible();
  await page.getByRole("button", { name: "Gripping" }).click();
  await page.getByRole("button", { name: "Lean in" }).click();
  await page.getByRole("button", { name: "Around 2 hours" }).click();
  await expect(page.getByRole("button", { name: "Lean in" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /Deal 15 films/ }).click();

  // Deck: save, skip, save, seen, save, save → four saves end the deck early.
  await expect(page.getByText("1/15")).toBeVisible();
  const handled: Record<string, string> = {};
  for (const action of ["Save", "Skip", "Save", "Seen it", "Save", "Save"] as const) {
    const title = await currentTitle(page);
    handled[title] = action;
    await page.getByRole("button", { name: action, exact: true }).click();
  }
  expect(Object.keys(handled)).toHaveLength(6); // six different films

  // Head-to-head: four saves → three rounds.
  await expect(page.getByRole("heading", { name: "This or that?" })).toBeVisible();
  await expect(page.getByText("Round 1 of 3")).toBeVisible();
  for (let round = 1; round <= 3; round++) {
    await page.getByRole("button", { name: /^Choose / }).first().click();
  }

  // Tonight's pick, with a reason and the other saves kept for later.
  await expect(page.getByText(/Tonight's pick · Gripping/)).toBeVisible();
  await expect(page.getByText(/beat 3 other saves for a gripping, lean in night/)).toBeVisible();
  await expect(page.getByText("Also saved for another night")).toBeVisible();

  // The database agrees.
  const [session] = await query<{ status: string; shortlist: unknown[]; why_source: string }>(
    "select status, shortlist, why_source from pick_sessions order by created_at desc limit 1",
  );
  expect(session.status).toBe("picked");
  expect(session.shortlist).toHaveLength(4);
  expect(session.why_source).toBe("rules");
  const [counts] = await query<Record<string, string>>(`
    select count(*) filter (where saved) as saved, count(*) filter (where seen) as seen,
           count(*) filter (where skipped) as skipped, count(*) filter (where picked_at is not null) as picked
    from title_states`);
  expect(counts).toEqual({ saved: "3", seen: "1", skipped: "1", picked: "1" });
  const [{ actions }] = await query<{ actions: string }>("select count(*) as actions from title_actions");
  expect(actions).toBe("7"); // six swipes and the pick

  // Deal again: nothing you've handled comes back.
  await page.getByRole("button", { name: "Start again" }).click();
  await page.getByRole("button", { name: /Deal 15 films/ }).click();
  await expect(page.getByText("1/15")).toBeVisible();
  const [latest] = await query<{ deck: { externalId: string }[] }>(
    "select deck from pick_sessions order by created_at desc limit 1",
  );
  const handledIds = (await query<{ external_id: string }>("select external_id from title_states")).map((r) => r.external_id);
  const dealt = latest.deck.map((e) => e.externalId);
  expect(handledIds).toHaveLength(6);
  expect(dealt.filter((id) => handledIds.includes(id))).toEqual([]);

  // A Hindi romance that isn't acclaimed fails your language rule and is never dealt.
  const everDealt = (await query<{ deck: { externalId: string }[] }>("select deck from pick_sessions")).flatMap((r) =>
    r.deck.map((e) => e.externalId),
  );
  expect(everDealt).not.toContain("4999");
  // Mostly English, with the other languages included.
  const english = dealt.filter((id) => Number(id) < 2000).length;
  expect(english).toBeGreaterThanOrEqual(dealt.length / 2);
  expect(english).toBeLessThan(dealt.length);
});

test("swipe gestures and keys work on the deck", async ({ page, isMobile }) => {
  await page.goto("/movies");
  await page.getByRole("button", { name: /Deal 15 films/ }).click();
  await expect(page.getByText("1/15")).toBeVisible();

  // Drag the card to the right: a save.
  const first = await currentTitle(page);
  const card = page.locator("[class*='cursor-grab']").first();
  const box = (await card.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2, { steps: 6 });
  await page.mouse.move(box.x + box.width / 2 + 240, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect(page.getByText("2/15")).toBeVisible();
  await expect.poll(async () => (await currentTitle(page)) !== first).toBe(true);
  await expect(page.getByRole("list", { name: "1 of 4 saved" })).toBeVisible();

  if (!isMobile) {
    // Keyboard on a laptop: ← skip, ↑ seen.
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByText("3/15")).toBeVisible();
    await page.keyboard.press("ArrowUp");
    await expect(page.getByText("4/15")).toBeVisible();
  }
});

test("the deck never scrolls sideways", async ({ page }) => {
  await page.goto("/movies");
  await page.getByRole("button", { name: /Deal 15 films/ }).click();
  await expect(page.getByText("1/15")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
