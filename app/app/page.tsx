import Link from "next/link";
import { MoodStart } from "@/components/mood-start";
import { getCurrentUser } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/config";

export const metadata = { title: "Pick a mood" };

export default async function MoodPage() {
  const user = supabaseConfigured() ? await getCurrentUser() : null;

  return (
    <main className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Pick a mood</h1>
        <p className="mt-1.5 text-sm text-ink-400">
          {user
            ? "Films you have already handled are filtered out of every deck."
            : "You are browsing as a guest — your lists live on this device until you sign in."}
        </p>
      </header>

      <MoodStart />

      {!user && supabaseConfigured() && (
        <p className="text-xs text-ink-500">
          <Link href="/login" className="underline underline-offset-4 hover:text-ink-300">
            Create an account
          </Link>{" "}
          to sync your watchlist across devices.
        </p>
      )}
    </main>
  );
}
