"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * "How was it?" right after Seen it / Read it: five stars or Skip, then
 * `onDone` (which usually moves the flow on). The stars fill as you tap.
 */
export function StarPrompt({ title, onRate, onDone }: { title: string; onRate: (stars: number) => void; onDone: () => void }) {
  const [shown, setShown] = useState(0);
  return (
    <div className="flex flex-col items-center gap-1">
      <p className="text-sm font-semibold">How was it?</p>
      <div role="group" aria-label={`Rate ${title}`} className="flex">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            disabled={shown > 0}
            onClick={() => {
              setShown(n);
              onRate(n);
              onDone();
            }}
            className="p-2"
          >
            <Star className={cn("size-7 transition-transform", n <= shown ? "scale-110 fill-current" : "opacity-40")} aria-hidden />
          </button>
        ))}
      </div>
      <button type="button" onClick={onDone} disabled={shown > 0} className="text-sm text-muted underline underline-offset-4">
        Skip
      </button>
    </div>
  );
}
