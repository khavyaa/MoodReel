import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseConfigured, supabaseEnv } from "@/lib/supabase/config";

const PROTECTED_PREFIXES = ["/app/watchlist", "/app/watched", "/app/settings"];

/** Refreshes the Supabase session cookie and guards the account-bound routes. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!supabaseConfigured()) return response;

  const { url, anonKey } = supabaseEnv();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  if (!user && PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}
