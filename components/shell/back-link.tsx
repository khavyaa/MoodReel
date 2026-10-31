"use client";

import Link from "next/link";

/**
 * "← Back" that goes back where you came from (Settings, the landing page,
 * sign-in) when you came from inside MoodReel, and to the front door otherwise.
 * A real link underneath, so it works before (or without) any script.
 */
export function BackLink({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      onClick={(e) => {
        const fromHere = document.referrer && new URL(document.referrer).origin === window.location.origin;
        if (fromHere && window.history.length > 1) {
          e.preventDefault();
          window.history.back();
        }
      }}
      className={className}
    >
      ← Back
    </Link>
  );
}
