export const metadata = { title: "Offline" };

/**
 * What the home-screen app shows with no connection, for pages it hasn't kept
 * (the service worker keeps Saved, History and the start screens).
 */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col justify-center gap-6 px-5 pt-[max(2rem,env(safe-area-inset-top))] pb-16 sm:px-8 lg:px-12">
      <span className="display text-[26px] leading-none">MoodReel</span>
      <h1 className="display text-[clamp(3rem,8vw,7rem)]">You&apos;re offline</h1>
      <p className="max-w-[52ch] text-lg text-muted">
        Picking needs a connection, but what you&apos;ve saved, your history, and the series and books you&apos;re
        part-way through open from your last visit.
      </p>
      <nav aria-label="Available offline" className="flex flex-wrap gap-3">
        {/* Plain links on purpose: a full page load goes through the service worker, which has the kept copies. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/saved" className="rounded-full border-2 border-line px-5 py-3 font-bold hover:bg-soft">
          Saved
        </a>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/history" className="rounded-full border-2 border-line px-5 py-3 font-bold hover:bg-soft">
          History
        </a>
        {/* A link to this same address reloads it: no script needed, so it works on the kept copy alone. */}
        <a href="" className="rounded-full bg-accent px-5 py-3 font-bold text-on-accent hover:opacity-90">
          Try again
        </a>
      </nav>
    </main>
  );
}
