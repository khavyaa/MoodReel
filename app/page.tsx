import Link from "next/link";
import { Bookmark, Layers, Sparkles } from "lucide-react";
import { MoodStart } from "@/components/mood-start";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/config";

const HIGHLIGHTS = [
  { icon: Sparkles, title: "Mood first", body: "Ten hand-tuned moods, not an endless genre tree." },
  { icon: Layers, title: "Swipe to decide", body: "Right to save, left to skip, up if you have seen it." },
  { icon: Bookmark, title: "It remembers", body: "Handled films never come back to clutter your deck." },
];

export default async function LandingPage() {
  const user = await getCurrentUser();

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-5 pb-16 pt-12">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-ember-400">MoodReel</p>
        <h1 className="mt-3 text-4xl font-semibold leading-[1.1] tracking-tight text-ink-100">
          Movies that match
          <br />
          the mood you are in.
        </h1>
        <p className="mt-4 text-base leading-relaxed text-ink-300">
          Pick a feeling, swipe through English, Hindi and Tamil films, and keep a watchlist that
          actually remembers what you have already seen.
        </p>
      </header>

      <div className="mt-7 flex flex-wrap gap-3">
        {user ? (
          <Link href="/app">
            <Button size="lg">Open MoodReel</Button>
          </Link>
        ) : (
          <>
            {supabaseConfigured() && (
              <Link href="/login">
                <Button size="lg">Sign in</Button>
              </Link>
            )}
            <Link href="/app">
              <Button size="lg" variant="secondary">
                Continue as guest
              </Button>
            </Link>
          </>
        )}
      </div>

      <ul className="mt-10 grid gap-3">
        {HIGHLIGHTS.map(({ icon: Icon, title, body }) => (
          <li
            key={title}
            className="flex gap-3 rounded-2xl border border-ink-800 bg-ink-900 px-4 py-3.5"
          >
            <Icon className="mt-0.5 size-5 shrink-0 text-ember-400" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-ink-100">{title}</p>
              <p className="text-sm text-ink-400">{body}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-12 border-t border-ink-800 pt-10">
        <MoodStart />
      </div>

      <footer className="mt-12 text-xs text-ink-500">
        <Link href="/about" className="underline underline-offset-4 hover:text-ink-300">
          About &amp; credits
        </Link>
        <p className="mt-2">
          This product uses the TMDb API but is not endorsed or certified by TMDb.
        </p>
      </footer>
    </main>
  );
}
