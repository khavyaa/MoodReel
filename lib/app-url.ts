import "server-only";

/**
 * The app's public base URL, used for auth redirect links and metadata.
 *
 * Set NEXT_PUBLIC_APP_URL to pin it. Otherwise this falls back to the domain
 * Vercel injects at build and run time, which avoids the deploy-order problem:
 * you cannot know the production URL until the first deploy, but the first
 * deploy already needs it.
 *
 * VERCEL_PROJECT_PRODUCTION_URL is the stable production domain, not the
 * per-deployment URL, so preview builds still emit auth links that point at the
 * domain registered with Supabase. It is server-only, which is fine: every
 * caller here runs on the server.
 */
export function getAppUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return explicit.replace(/\/$/, "");

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;

  return "http://localhost:3000";
}
