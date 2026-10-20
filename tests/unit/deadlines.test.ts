import { afterEach, describe, expect, it, vi } from "vitest";
import { tmdb } from "@/lib/tmdb/client";
import { bookDescription } from "@/lib/books/openlibrary";

/*
 * Every catalogue request carries a deadline, so one stalled call can't hold
 * up a deck or a list: TMDb and Open Library both pass an abort signal.
 */

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function captureFetch() {
  const signals: (AbortSignal | undefined)[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: unknown, init?: RequestInit) => {
      signals.push(init?.signal ?? undefined);
      return new Response(JSON.stringify({ ok: true, description: "x" }), { status: 200 });
    }),
  );
  return signals;
}

describe("catalogue requests have a deadline", () => {
  it("TMDb", async () => {
    vi.stubEnv("TMDB_ACCESS_TOKEN", "test");
    const signals = captureFetch();
    await tmdb("/movie/1");
    expect(signals).toHaveLength(1);
    expect(signals[0]).toBeInstanceOf(AbortSignal);
  });

  it("Open Library", async () => {
    const signals = captureFetch();
    await bookDescription(1);
    expect(signals).toHaveLength(1);
    expect(signals[0]).toBeInstanceOf(AbortSignal);
  });
});
