/**
 * MoodReel runs without Supabase configured: auth is simply unavailable and the
 * app falls back to local guest storage. Every Supabase helper checks this first.
 */
export function supabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function supabaseEnv() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
  };
}
