"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { followList } from "@/app/(app)/list-actions";
import { cn } from "@/lib/cn";

/** Follow / Following for a list: no page refresh, the button holds the state. */
export function FollowListButton({ slug, initial }: { slug: string; initial: boolean }) {
  const [following, setFollowing] = useState(initial);
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={following}
      onClick={() => {
        const next = !following;
        setFollowing(next);
        startTransition(async () => {
          try {
            await followList(slug, next);
          } catch {
            setFollowing(!next);
          }
        });
      }}
      className={cn(
        "inline-flex h-12 items-center gap-2 rounded-full border-2 px-5 font-bold disabled:opacity-60",
        following ? "border-accent bg-accent text-on-accent" : "border-line hover:bg-soft",
      )}
    >
      {following ? (
        <>
          <Check className="size-4" aria-hidden /> Following
        </>
      ) : (
        "Follow"
      )}
    </button>
  );
}

/** "47 of 250 seen", as a thin bar. */
export function Progress({ seen, total, word }: { seen: number; total: number; word: string }) {
  const share = total ? Math.round((seen / total) * 100) : 0;
  return (
    <div className="flex flex-col gap-1.5">
      <div
        role="progressbar"
        aria-label={`${seen} of ${total} ${word}`}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={seen}
        className="h-1.5 w-full overflow-hidden rounded-full bg-soft shadow-[inset_0_0_0_1px_var(--line)]"
      >
        <div className="h-full rounded-full bg-accent" style={{ width: `${share}%` }} />
      </div>
      <span className="text-xs font-semibold text-muted">
        {total ? `${seen} of ${total} ${word}` : "Fills in when you open it"}
      </span>
    </div>
  );
}
