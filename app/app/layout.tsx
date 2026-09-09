import Link from "next/link";
import { BottomNav } from "@/components/bottom-nav";
import { getCurrentUser } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/config";

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const user = supabaseConfigured() ? await getCurrentUser() : null;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-30 border-b border-ink-800 bg-ink-950/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-5">
          <Link href="/app" className="font-mono text-xs uppercase tracking-[0.3em] text-ember-400">
            MoodReel
          </Link>
          {user ? (
            <span className="max-w-[50%] truncate text-xs text-ink-400">{user.email}</span>
          ) : (
            <Link href="/login" className="text-xs font-medium text-ink-300 hover:text-ink-100">
              Sign in
            </Link>
          )}
        </div>
      </header>

      <div className="mx-auto w-full max-w-lg flex-1 px-5 pb-8 pt-6">{children}</div>

      <BottomNav />
    </div>
  );
}
