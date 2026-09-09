import { NextResponse } from "next/server";
import { TmdbError } from "@/lib/tmdb";

export function jsonError(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

/** Maps thrown errors onto sensible status codes for every API route. */
export function handleRouteError(error: unknown) {
  if (error instanceof TmdbError) {
    return jsonError(error.message, error.status, {
      code: error.status === 503 ? "tmdb_not_configured" : "tmdb_error",
    });
  }
  console.error("[moodreel] unexpected route error", error);
  return jsonError("Something went wrong.", 500);
}

/** Parses `?languages=en,hi` into validated codes, defaulting to all three. */
export function parseLanguages(raw: string | null): ("en" | "hi" | "ta")[] {
  const allowed = ["en", "hi", "ta"] as const;
  if (!raw) return [...allowed];
  const parsed = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is (typeof allowed)[number] =>
      (allowed as readonly string[]).includes(s),
    );
  return parsed.length ? [...new Set(parsed)] : [...allowed];
}

export function parseIdList(raw: string | null): number[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
}
