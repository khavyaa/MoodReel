import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/*
 * MoodReel has exactly one account. It is created, or recovered on a new
 * device, through /setup with OWNER_SETUP_TOKEN. Setup issues a short-lived
 * signed grant, and the passkey plugin only accepts a new passkey from a
 * signed-out browser when it carries a valid grant.
 */

export const GRANT_TTL_MS = 10 * 60 * 1000;

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

/** Constant-time comparison that also hides the expected token's length. */
export function tokensMatch(given: string, expected: string | undefined): boolean {
  if (!expected || !given) return false;
  return timingSafeEqual(digest(given), digest(expected));
}

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function signOwnerGrant(userId: string, secret: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ u: userId, e: now + GRANT_TTL_MS })).toString(
    "base64url",
  );
  return `${payload}.${sign(payload, secret)}`;
}

export function verifyOwnerGrant(
  grant: string | null | undefined,
  secret: string,
  now = Date.now(),
): { userId: string } | null {
  if (!grant) return null;
  const [payload, signature] = grant.split(".");
  if (!payload || !signature) return null;

  const expected = Buffer.from(sign(payload, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  try {
    const { u, e } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof u !== "string" || !u || typeof e !== "number" || e < now) return null;
    return { userId: u };
  } catch {
    return null;
  }
}
