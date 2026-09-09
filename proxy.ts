import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export default async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|.*\\.(?:svg|png|jpg|jpeg|webp|gif|ico)$).*)"],
};
