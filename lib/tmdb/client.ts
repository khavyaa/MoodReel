import "server-only";

/*
 * TMDb over HTTPS, server-side only (the token never reaches the browser).
 * Connections to TMDb drop now and then (ECONNRESET on a cold socket, the odd
 * 429/5xx). In v1 one dropped request silently removed a whole language from a
 * deck, so transient failures are retried before they're believed.
 */

/** Overridable only so end-to-end tests can point at a fixed fake TMDb. */
const TMDB_BASE = process.env.TMDB_BASE_URL || "https://api.themoviedb.org/3";
const MAX_ATTEMPTS = 3;
/** One TMDb request may take this long before it's abandoned (and retried): a stalled call never holds up a deck. */
const REQUEST_TIMEOUT_MS = 8000;

export class TmdbError extends Error {
  constructor(
    message: string,
    /** HTTP status from TMDb, or 0 for a network failure. */
    readonly status: number,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "TmdbError";
  }
}

export function tmdbConfigured() {
  return Boolean(process.env.TMDB_ACCESS_TOKEN);
}

type Params = Record<string, string | number | boolean | undefined>;

export function buildTmdbUrl(path: string, params: Params = {}) {
  const url = new URL(`${TMDB_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  return url;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @param revalidate seconds Next may reuse the response. TMDb's terms discourage
 * holding data indefinitely, so callers keep this to hours, not days.
 */
export async function tmdb<T>(path: string, params: Params = {}, revalidate = 60 * 60): Promise<T> {
  const token = process.env.TMDB_ACCESS_TOKEN;
  if (!token) throw new TmdbError("TMDB_ACCESS_TOKEN is not set on the server.", 0, false);
  const url = buildTmdbUrl(path, params);

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, accept: "application/json" },
        next: { revalidate },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (res.ok) return (await res.json()) as T;
      const retryable = res.status === 429 || res.status >= 500;
      const error = new TmdbError(`TMDb ${res.status} for ${path}`, res.status, retryable);
      if (!retryable) throw error;
      lastError = error;
    } catch (error) {
      if (error instanceof TmdbError && !error.retryable) throw error;
      lastError = error;
    }
    if (attempt < MAX_ATTEMPTS) await sleep(150 * 2 ** (attempt - 1) + Math.random() * 100);
  }
  throw lastError instanceof TmdbError
    ? lastError
    : new TmdbError(`TMDb unreachable for ${path}: ${String(lastError)}`, 0, true);
}
