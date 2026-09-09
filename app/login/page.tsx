import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getCurrentUser } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/config";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const target = next && next.startsWith("/") ? next : "/app";

  if (supabaseConfigured() && (await getCurrentUser())) redirect(target);

  return (
    <main className="mx-auto w-full max-w-sm flex-1 px-5 pb-16 pt-16">
      <Link href="/" className="font-mono text-xs uppercase tracking-[0.3em] text-ember-400">
        MoodReel
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Sign in to keep your lists</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-400">
        Your swipes sync across devices once you have an account. You can also{" "}
        <Link href="/app" className="text-ink-200 underline underline-offset-4">
          keep browsing as a guest
        </Link>
        .
      </p>

      <div className="mt-8">
        {supabaseConfigured() ? (
          <AuthForm next={target} />
        ) : (
          <p className="rounded-xl border border-ink-800 bg-ink-900 px-4 py-5 text-sm leading-relaxed text-ink-300">
            Supabase is not configured on this deployment, so accounts are unavailable. Guest mode
            still works and stores your lists on this device.
          </p>
        )}
      </div>
    </main>
  );
}
