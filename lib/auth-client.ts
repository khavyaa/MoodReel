"use client";

import { createAuthClient } from "better-auth/react";
import { passkeyClient } from "@better-auth/passkey/client";

export const authClient = createAuthClient({ plugins: [passkeyClient()] });

/** Turns WebAuthn and Better Auth failures into something a person can act on. */
export function passkeyErrorMessage(error: unknown): string {
  const name = (error as { name?: string })?.name;
  const message = (error as { message?: string })?.message ?? "";
  if (name === "NotAllowedError" || /cancel|not allowed|timed out/i.test(message)) {
    return "The passkey prompt was closed before it finished. Try again when you're ready.";
  }
  if (name === "InvalidStateError") {
    return "This device already has a passkey for MoodReel. Sign in with it instead.";
  }
  return message || "Something went wrong with the passkey. Try again.";
}
