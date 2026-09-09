import Link from "next/link";
import { SettingsClient } from "@/components/settings-client";
import { Button } from "@/components/ui/button";
import { signOut } from "@/app/login/actions";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/config";
import type { LanguageCode, Profile } from "@/lib/types";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  let profile: Profile | null = null;
  let email: string | null = null;

  if (supabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = (await supabase?.auth.getUser()) ?? { data: { user: null } };
    if (user) {
      email = user.email ?? null;
      const { data } = await supabase!
        .from("profiles")
        .select("id, display_name, preferred_languages, onboarding_completed")
        .eq("id", user.id)
        .maybeSingle();
      profile = {
        id: user.id,
        displayName: (data?.display_name as string | null) ?? null,
        preferredLanguages:
          ((data?.preferred_languages as LanguageCode[] | null) ?? ["en", "hi", "ta"]),
        onboardingCompleted: Boolean(data?.onboarding_completed),
      };
    }
  }

  return (
    <main className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-ink-400">
          {email ?? "Browsing as a guest on this device."}
        </p>
      </header>

      <SettingsClient profile={profile} />

      <section className="space-y-3 border-t border-ink-800 pt-8">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-ink-400">Account</h2>
        {email ? (
          <form action={signOut}>
            <Button type="submit" variant="secondary">
              Sign out
            </Button>
          </form>
        ) : (
          <Link href="/login">
            <Button variant="secondary">Sign in or create an account</Button>
          </Link>
        )}
      </section>

      <footer className="border-t border-ink-800 pt-8 text-xs text-ink-500">
        <Link href="/about" className="underline underline-offset-4 hover:text-ink-300">
          About &amp; TMDb credits
        </Link>
        <p className="mt-2">
          This product uses the TMDb API but is not endorsed or certified by TMDb.
        </p>
      </footer>
    </main>
  );
}
