import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/*
 * Optimistic gate: checks only that a session cookie exists, never the database
 * (this runs on every request, prefetches included). Pages and API routes still
 * verify the session for real through lib/session.ts.
 */

const PUBLIC_PATHS = ["/sign-in", "/setup", "/about"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const signedIn = Boolean(getSessionCookie(request));

  if (!signedIn && !isPublic(pathname)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.search = pathname === "/" || pathname === "/movies" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  if (signedIn && pathname === "/sign-in") {
    return NextResponse.redirect(new URL("/movies", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|icon|apple-icon|manifest|.*\\.(?:svg|png|jpg|jpeg|webp|ico|txt|webmanifest)$).*)",
  ],
};
