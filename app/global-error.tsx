"use client";

import "./globals.css";
import { fontVariables } from "./fonts";

/**
 * When even the root layout fails. It renders its own document (so it brings
 * the styles and fonts itself) in MoodReel's look rather than Next's default,
 * with Try again and the pages that usually still work.
 */
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en" className={`${fontVariables} h-full`}>
      <body className="tint-frame flex min-h-full flex-col" data-tinted="" style={{ "--t": "#FF4A1C" } as React.CSSProperties}>
        <title>Something went wrong · MoodReel</title>
        <ErrorScreen retry={retry} />
      </body>
    </html>
  );
}

function ErrorScreen({ retry }: { retry: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col justify-center gap-6 px-5 py-16 sm:px-8 lg:px-12">
      <span className="display text-[26px] leading-none">MoodReel</span>
      <h1 className="display text-[clamp(3rem,8vw,7rem)]">Something went wrong</h1>
      <p className="max-w-[52ch] text-lg text-muted">That didn&apos;t load. It&apos;s usually brief: try again, or go to your saves.</p>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={retry} className="rounded-full bg-accent px-5 py-3 font-bold text-on-accent hover:opacity-90">
          Try again
        </button>
        {/* Full page loads on purpose: whatever broke may be in the app's own navigation. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/saved" className="rounded-full border-2 border-line px-5 py-3 font-bold hover:bg-soft">
          Saved
        </a>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/history" className="rounded-full border-2 border-line px-5 py-3 font-bold hover:bg-soft">
          History
        </a>
      </div>
    </main>
  );
}
