"use client";

import { useEffect } from "react";
import { AppFrame } from "@/components/shell/app-frame";

/** Something on a page broke: say so in MoodReel's look, with Try again and the pages that usually still work. */
export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error("[moodreel]", error);
  }, [error]);
  return (
    <AppFrame>
      <div className="flex flex-1 flex-col justify-center gap-6">
        <span className="label text-muted">Something went wrong</span>
        <h1 className="display text-[clamp(3rem,8vw,7rem)]">That didn&apos;t load</h1>
        <p className="max-w-[52ch] text-lg text-muted">
          It&apos;s usually brief: the catalogue or the connection hiccuped. Try again, or open your saves.
        </p>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={retry} className="rounded-full bg-accent px-5 py-3 font-bold text-on-accent hover:opacity-90">
            Try again
          </button>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/saved" className="rounded-full border-2 border-line px-5 py-3 font-bold hover:bg-soft">
            Saved
          </a>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/history" className="rounded-full border-2 border-line px-5 py-3 font-bold hover:bg-soft">
            History
          </a>
        </div>
      </div>
    </AppFrame>
  );
}
