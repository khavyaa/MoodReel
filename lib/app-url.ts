/**
 * The app's public base URL. Passkeys are bound to this origin, so it has to be
 * the address you actually open the app at.
 *
 * Read at runtime from APP_URL (deliberately not NEXT_PUBLIC_*: Next bakes those
 * into the build, so a stale value compiled in can't be corrected by the
 * server's environment). Otherwise this falls back to the domain
 * Vercel injects at build and run time, which avoids the deploy-order problem:
 * you cannot know the production URL until the first deploy, but the first
 * deploy already needs it.
 *
 * VERCEL_PROJECT_PRODUCTION_URL is the stable production domain, not the
 * per-deployment URL. A passkey registered on production therefore cannot sign
 * in on a preview deployment's own URL; previews are for checking builds.
 */
export function getAppUrl(): string {
  const explicit = process.env.APP_URL;
  if (explicit) return explicit.replace(/\/$/, "");

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;

  return "http://localhost:3000";
}
