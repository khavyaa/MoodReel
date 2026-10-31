import { expect, test, type Page } from "@playwright/test";
import { E2E_SETUP_TOKEN } from "../../playwright.config";
import { claimAccount, query, resetDatabase } from "./passkey";
import { flow } from "./flow";

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

  // Deck: save, skip, save, seen (rated on the card), save, save → four saves end the deck early.
  await expect(page.getByText("1/15")).toBeVisible();
  const handled: Record<string, string> = {};
  for (const action of ["Save", "Skip", "Save", "Seen it", "Save", "Save"] as const) {
    const title = await currentTitle(page);
    handled[title] = action;
    await page.getByRole("button", { name: action, exact: true }).click();
    if (action === "Seen it") {
      // The same card stays in front with stars over it; a star rates it and sends it off.
      await expect(page.getByText(/^\d+\/15$/)).toHaveText("4/15");
      await page.getByRole("group", { name: `Rate ${title}` }).getByRole("button", { name: "4 stars" }).click();
      await expect(page.getByText("5/15")).toBeVisible();
    }
  }
  expect(Object.keys(handled)).toHaveLength(6); // six different films
  await expect
    .poll(async () => (await query<{ rating: number | null }>("select rating from title_states where seen and media = 'movie' order by updated_at desc limit 1"))[0]?.rating)
    .toBe(8);

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

test("saved and history show the run, and you can tidy and rate them", async ({ page }) => {
  // Saved: the three saves that didn't win.
  await page.goto("/saved");
  await expect(page.getByText("Saved · 3 films")).toBeVisible();
  const flowed = flow(page, "Saved titles");
  const saved = flowed.getByRole("listitem");
  await expect(saved).toHaveCount(3);
  const where = flowed.getByRole("link", { name: /Where to watch/ });
  await expect(where).toHaveAttribute("href", /^https:\/\/www\.google\.com\/search\?q=.+movie/);

  // The buttons belong to the poster in front.
  await flowed.getByRole("button", { name: "Remove" }).click();
  await expect(saved).toHaveCount(2);
  await flowed.getByRole("button", { name: "Seen it" }).click();
  await flowed.getByRole("button", { name: "Skip" }).click();
  await expect(saved).toHaveCount(1);
  await expect
    .poll(async () => (await query<{ n: string }>("select count(*) as n from title_states where saved"))[0].n)
    .toBe("1");
  await page.reload();
  await expect(page.getByText("Saved · 1 film")).toBeVisible();

  // History: the pick, its mood and reason. It isn't watched until you say so.
  await page.goto("/history");
  await expect(page.getByText("History · 1 pick")).toBeVisible();
  await expect(page.getByText(/beat 3 other saves/)).toBeVisible();
  await page.getByRole("button", { name: "Yes, watched it" }).click();
  await page.getByRole("button", { name: "4 stars" }).click();
  await expect
    .poll(async () => (await query<{ rating: number | null; seen: boolean }>("select rating, seen from title_states where picked_at is not null"))[0])
    .toEqual({ rating: 8, seen: true });
  await page.reload();
  await expect(page.getByRole("button", { name: "4 stars" })).toHaveAttribute("aria-pressed", "true");

  // Re-rating changes the state only, never the taste log.
  await page.getByRole("button", { name: "5 stars" }).click();
  await expect
    .poll(async () => (await query<{ rating: number }>("select rating from title_states where picked_at is not null"))[0].rating)
    .toBe(10);
  const [{ actions }] = await query<{ actions: string }>(
    "select count(*) as actions from title_actions where action in ('unsaved', 'seen') and pick_session_id is null",
  );
  expect(actions).toBe("3"); // remove, seen, and "watched it"; ratings are not logged
  const [{ follow_up }] = await query<{ follow_up: string }>("select follow_up from pick_sessions where status = 'picked'");
  expect(follow_up).toBe("watched");
});

test("not for me, undo, and the full synopsis", async ({ page, isMobile }) => {
  await page.goto("/movies");
  await page.getByRole("button", { name: /Deal 15 films/ }).click();
  await expect(page.getByText("1/15")).toBeVisible();
  const before = Number((await query<{ n: string }>("select count(*) as n from title_actions"))[0].n);

  if (isMobile) {
    // A phone card keeps the synopsis behind More about it, so the card and its buttons fit the screen.
    await page.getByRole("button", { name: "More about it" }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByText(/The end\./)).toBeVisible();
    await sheet.getByRole("button", { name: "Close" }).click();
    await expect(sheet).toHaveCount(0);
  } else {
    // The synopsis is clipped, with More to read the rest.
    await page.getByRole("button", { name: "More", exact: true }).click();
    await expect(page.getByText(/The end\./)).toBeVisible();
    await expect(page.getByRole("button", { name: "Less" })).toBeVisible();
  }

  // Not for me, then undo: the same card is back and nothing was kept.
  const first = await currentTitle(page);
  await page.getByRole("button", { name: "Not for me", exact: true }).click();
  await expect(page.getByText("2/15")).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("1/15")).toBeVisible();
  await expect.poll(() => currentTitle(page)).toBe(first);
  await expect
    .poll(async () => Number((await query<{ n: string }>("select count(*) as n from title_actions"))[0].n))
    .toBe(before);
  expect(await query("select 1 from title_states where external_id = (select external_id from title_states order by updated_at desc limit 1) and disliked")).toEqual([]);

  // Two steps forward, two back (Z on a laptop, the button on a phone).
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await page.getByRole("button", { name: "Seen it", exact: true }).click();
  // Seen it holds the card with stars; Undo first just closes them, leaving the card where it was.
  await expect(page.getByRole("group", { name: /^Rate / })).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("group", { name: /^Rate / })).toHaveCount(0);
  await expect(page.getByText("2/15")).toBeVisible();
  await page.getByRole("button", { name: "Seen it", exact: true }).click();
  await page.getByRole("button", { name: "5 stars" }).click();
  await expect(page.getByText("3/15")).toBeVisible();
  for (const n of [2, 1]) {
    if (isMobile) await page.getByRole("button", { name: "Undo" }).click();
    else await page.keyboard.press("z");
    await expect(page.getByText(`${n}/15`)).toBeVisible();
  }
  await expect.poll(() => currentTitle(page)).toBe(first);
  await expect(page.getByRole("button", { name: "Undo" })).toBeHidden(); // nothing left to undo
  await expect
    .poll(async () => Number((await query<{ n: string }>("select count(*) as n from title_actions"))[0].n))
    .toBe(before);

  // Drag down: not for me, for good. Wait for the returned card to settle first.
  const card = page.locator("[class*='cursor-grab']").first();
  await card.scrollIntoViewIfNeeded();
  let box = (await card.boundingBox())!;
  await expect
    .poll(async () => {
      const now = (await card.boundingBox())!;
      const still = Math.abs(now.y - box.y) < 1 && Math.abs(now.x - box.x) < 1;
      box = now;
      return still;
    })
    .toBe(true);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 120, { steps: 6 });
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 240, { steps: 6 });
  await page.mouse.up();
  await expect(page.getByText("2/15")).toBeVisible();
  await expect
    .poll(async () => (await query<{ n: string }>("select count(*) as n from title_states where disliked"))[0].n)
    .toBe("1");
});

test("pick from saved: the best-fitting saves go straight to the head-to-head", async ({ page }) => {
  // Save two more, then leave the deck.
  await page.goto("/movies");
  await page.getByRole("button", { name: /Deal 15 films/ }).click();
  await expect(page.getByText("1/15")).toBeVisible();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("3/15")).toBeVisible();
  await expect
    .poll(async () => (await query<{ n: string }>("select count(*) as n from title_states where saved"))[0].n)
    .toBe("3");

  await page.goto("/saved");
  await expect(page.getByText("Saved · 3 films")).toBeVisible();
  await page.getByRole("button", { name: "Pick from these" }).click();
  await page.getByRole("button", { name: "Pick from my saved" }).click();
  await expect(page.getByRole("heading", { name: "This or that?" })).toBeVisible();
  await expect(page.getByText(/From your saved list · Round 1 of 2/)).toBeVisible();
  await page.getByRole("button", { name: /^Choose / }).first().click();
  await page.getByRole("button", { name: /^Choose / }).first().click();
  await expect(page.getByText(/Tonight's pick · Gripping/)).toBeVisible();

  await expect
    .poll(async () => (await query<{ origin: string; status: string }>("select origin, status from pick_sessions order by created_at desc limit 1"))[0])
    .toEqual({ origin: "saved", status: "picked" });
  const [{ n }] = await query<{ n: string }>("select count(*) as n from title_states where saved");
  expect(n).toBe("2"); // the winner moved to history; the others stay saved
});

test("a few hours after a pick, the start screen asks if you watched it", async ({ page }) => {
  // The pick is fresh: nothing to ask yet.
  await page.goto("/movies");
  await expect(page.getByRole("heading", { name: "What kind of night is it?" })).toBeVisible();
  await expect(page.getByText(/Did you watch/)).toHaveCount(0);

  // Hours later you come back to the app, which resumes instead of reloading: it still asks.
  await query("update pick_sessions set completed_at = now() - interval '4 hours' where status = 'picked' and follow_up is null");
  await page.evaluate(() => {
    const set = (state: string) => {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
      document.dispatchEvent(new Event("visibilitychange"));
    };
    set("hidden");
    const now = Date.now;
    Date.now = () => now() + 2 * 60_000;
    set("visible");
  });
  await expect(page.getByText(/Did you watch/)).toBeVisible();
  await page.getByRole("button", { name: "Not yet" }).click();
  await expect(page.getByText(/is back in Saved/)).toBeVisible();
  await expect
    .poll(async () => (await query<{ follow_up: string | null }>("select follow_up from pick_sessions where origin = 'saved'"))[0].follow_up)
    .toBe("later");
  await page.reload();
  await expect(page.getByRole("heading", { name: "What kind of night is it?" })).toBeVisible();
  await expect(page.getByText(/Did you watch/)).toHaveCount(0);
  const [{ n }] = await query<{ n: string }>("select count(*) as n from title_states where saved");
  expect(n).toBe("3");
});

test("your streaming services are a setting", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByRole("checkbox", { name: "Netflix" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("checkbox", { name: "Prime Video" })).toBeVisible();
  // Rent-or-buy stores and add-on channels aren't subscriptions.
  await expect(page.getByRole("checkbox", { name: "Apple TV Store" })).toHaveCount(0);
  await expect(page.getByRole("checkbox", { name: /Channel/ })).toHaveCount(0);

  await page.getByRole("checkbox", { name: "Zee5" }).click();
  await page.getByRole("checkbox", { name: "Netflix" }).click();
  await expect
    .poll(async () => (await query<{ providers: number[] }>("select providers from preferences"))[0]?.providers)
    .toEqual([119, 350, 2336, 232]);

  // Decks now badge Zee5, never Netflix.
  await page.goto("/movies");
  await page.getByRole("button", { name: /Deal 15 films/ }).click();
  await expect(page.getByText("1/15")).toBeVisible();
  // In the fake TMDb only odd-numbered films stream (on Netflix and Zee5). Deck order varies
  // between deals, so go straight to the first odd one rather than hoping it's near the top.
  const deck = (
    await query<{ deck: { externalId: string }[] }>("select deck from pick_sessions order by created_at desc limit 1")
  )[0].deck.map((e) => Number(e.externalId));
  const firstStreaming = deck.findIndex((id) => id % 2 === 1);
  expect(firstStreaming).toBeGreaterThanOrEqual(0);
  for (let i = 0; i < firstStreaming; i++) await page.getByRole("button", { name: "Skip", exact: true }).click();
  await expect(page.getByText(`${firstStreaming + 1}/15`)).toBeVisible();
  await expect(page.getByText("On Zee5")).toBeVisible();
  await expect(page.getByText("On Netflix")).toHaveCount(0);
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
    // Keyboard on a laptop: ← skip, ↑ seen, then 1–5 to rate it.
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByText("3/15")).toBeVisible();
    const seen = await currentTitle(page);
    await page.keyboard.press("ArrowUp");
    await expect(page.getByRole("group", { name: `Rate ${seen}` })).toBeVisible();
    // Hold the seen back a moment: its stars must still land after it, not be lost racing ahead.
    let held = false;
    await page.route("**/movies", async (route) => {
      if (route.request().method() === "POST" && !held) {
        held = true;
        await new Promise((r) => setTimeout(r, 1500));
      }
      await route.continue();
    });
    await page.keyboard.press("4");
    await expect(page.getByText("4/15")).toBeVisible();
    await expect
      .poll(async () => (await query<{ rating: number | null }>("select rating from title_states where seen and media = 'movie' order by updated_at desc limit 1"))[0]?.rating)
      .toBe(8);
  }
});

test("the deck never scrolls sideways", async ({ page }) => {
  await page.goto("/movies");
  await page.getByRole("button", { name: /Deal 15 films/ }).click();
  await expect(page.getByText("1/15")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
