import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Exchanges the email-confirmation / OAuth code for a session cookie. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next");
  const next = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/app";

  if (code) {
    const supabase = await createClient();
    const { error } = (await supabase?.auth.exchangeCodeForSession(code)) ?? {
      error: new Error("Supabase is not configured."),
    };
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
