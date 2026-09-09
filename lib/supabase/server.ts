import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseConfigured, supabaseEnv } from "@/lib/supabase/config";

type ServerClient = ReturnType<typeof createServerClient>;

/** Request-scoped Supabase client. Null when Supabase is not configured. */
export async function createClient(): Promise<ServerClient | null> {
  if (!supabaseConfigured()) return null;
  const cookieStore = await cookies();
  const { url, anonKey } = supabaseEnv();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component: middleware refreshes the session instead.
        }
      },
    },
  });
}

export async function getCurrentUser() {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
