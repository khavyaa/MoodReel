"use server";

import { getOrCreateOwner } from "@/lib/owner-server";
import { signOwnerGrant, tokensMatch } from "@/lib/owner";

export type SetupState = { error?: string; grant?: string };

/**
 * Checks the setup token and returns a short-lived grant that lets this browser
 * register a passkey for the single MoodReel account (creating it the first time).
 */
export async function claimOwner(_prev: SetupState, formData: FormData): Promise<SetupState> {
  const expected = process.env.OWNER_SETUP_TOKEN;
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!expected || !secret) {
    return { error: "Setup is turned off here: OWNER_SETUP_TOKEN or BETTER_AUTH_SECRET isn't set." };
  }

  const token = String(formData.get("token") ?? "").trim();
  if (!tokensMatch(token, expected)) {
    // Slow down guessing. The token is long enough that this is a courtesy, not the defence.
    await new Promise((resolve) => setTimeout(resolve, 600));
    return { error: "That setup token doesn't match. Check it and try again." };
  }

  const owner = await getOrCreateOwner();
  return { grant: signOwnerGrant(owner.id, secret) };
}
