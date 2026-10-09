import { describe, expect, it } from "vitest";
import { GRANT_TTL_MS, signOwnerGrant, tokensMatch, verifyOwnerGrant } from "@/lib/owner";

const SECRET = "test-secret-with-enough-length-0123456789";

describe("owner grants", () => {
  it("round-trips a valid grant", () => {
    const grant = signOwnerGrant("user_123", SECRET, 1_000);
    expect(verifyOwnerGrant(grant, SECRET, 1_000)).toEqual({ userId: "user_123" });
  });

  it("expires after the TTL", () => {
    const grant = signOwnerGrant("user_123", SECRET, 1_000);
    expect(verifyOwnerGrant(grant, SECRET, 1_000 + GRANT_TTL_MS - 1)).not.toBeNull();
    expect(verifyOwnerGrant(grant, SECRET, 1_000 + GRANT_TTL_MS + 1)).toBeNull();
  });

  it("rejects a grant signed with another secret", () => {
    const grant = signOwnerGrant("user_123", "some-other-secret-value-0123456789", 1_000);
    expect(verifyOwnerGrant(grant, SECRET, 1_000)).toBeNull();
  });

  it("rejects a tampered payload, even with the original signature", () => {
    const [, signature] = signOwnerGrant("user_123", SECRET, 1_000).split(".");
    const forged = Buffer.from(JSON.stringify({ u: "attacker", e: 9e15 })).toString("base64url");
    expect(verifyOwnerGrant(`${forged}.${signature}`, SECRET, 1_000)).toBeNull();
  });

  it("rejects missing and malformed grants", () => {
    for (const bad of [null, undefined, "", "nodot", ".", "a.b.c", "!!!.???"]) {
      expect(verifyOwnerGrant(bad as string, SECRET)).toBeNull();
    }
  });
});

describe("tokensMatch", () => {
  it("matches only the exact token", () => {
    expect(tokensMatch("abc123", "abc123")).toBe(true);
    expect(tokensMatch("abc124", "abc123")).toBe(false);
    expect(tokensMatch("abc12", "abc123")).toBe(false);
  });

  it("never matches when setup is unconfigured or the input is empty", () => {
    expect(tokensMatch("anything", undefined)).toBe(false);
    expect(tokensMatch("", "abc123")).toBe(false);
    expect(tokensMatch("", "")).toBe(false);
  });
});
