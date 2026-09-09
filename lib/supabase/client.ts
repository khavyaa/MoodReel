"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabaseConfigured, supabaseEnv } from "@/lib/supabase/config";

type BrowserClient = ReturnType<typeof createBrowserClient>;

let cached: BrowserClient | null = null;

/** Returns null when Supabase is not configured, so callers can fall back to guest mode. */
export function createClient(): BrowserClient | null {
  if (!supabaseConfigured()) return null;
  if (cached) return cached;
  const { url, anonKey } = supabaseEnv();
  cached = createBrowserClient(url, anonKey);
  return cached;
}
