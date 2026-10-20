import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/*
 * Optimistic gate: checks only that a session cookie exists, never the database
 * (this runs on every request, prefetches included). Pages and API routes still
 * verify the session for real through lib/session.ts.
 */

// /api/cron checks its own secret (Vercel's cron sends it); it has no session cookie.
const PUBLIC_PATHS = ["/sign-in", "/setup", "/about", "/offline", "/api/cron"];

function isPublic(pathname: string) {
  // "/" is the landing page; signed in, it's the films start screen instead (below).
  return pathname === "/" || PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const signedIn = Boolean(getSessionCookie(request));

  if (!signedIn && !isPublic(pathname)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    // The app's front door goes to the landing page; any deeper link to sign-in, and back there after.
    url.pathname = pathname === "/movies" ? "/" : "/sign-in";
    url.search = pathname === "/movies" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  if (signedIn && (pathname === "/sign-in" || pathname === "/")) {
    return NextResponse.redirect(new URL("/movies", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|icon|apple-icon|manifest|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|webp|ico|txt|webmanifest)$).*)",
  ],
};
