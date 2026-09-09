/**
 * MoodReel runs without Supabase configured: auth is simply unavailable and the
 * app falls back to local guest storage. Every Supabase helper checks this first.
 *
 * Supabase is mid-migration between two key formats. New projects are issued a
 * publishable key (`sb_publishable_...`) exposed as NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 * older ones use the legacy anon JWT as NEXT_PUBLIC_SUPABASE_ANON_KEY. Both are
 * browser-safe and interchangeable here, so either name is accepted.
 *
 * These must be read as complete `process.env.X` expressions rather than looked
 * up dynamically: Next.js inlines NEXT_PUBLIC_* values into the client bundle at
 * build time by literal substitution, and a computed key would not be replaced.
 */
export function supabasePublishableKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    undefined
  );
}

export function supabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && supabasePublishableKey());
}

export function supabaseEnv() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    anonKey: supabasePublishableKey() as string,
  };
}
