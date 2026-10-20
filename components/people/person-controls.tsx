"use client";

import { useOptimistic, useState, useTransition } from "react";
import { saveFromPage, seenFromPage, setPerson } from "@/app/(app)/people-actions";
import type { Person } from "@/lib/people/types";
import { cn } from "@/lib/cn";
import { useMarkDone } from "@/components/flow/cover-flow";

/** Follow / Avoid on a person's page. Tapping the active one clears it. */
export function FollowAvoid({ person, initial }: { person: Person; initial: "follow" | "avoid" | null }) {
  const [, startTransition] = useTransition();
  const [state, setState] = useOptimistic(initial);

  function choose(kind: "follow" | "avoid") {
    const next = state === kind ? null : kind;
    startTransition(async () => {
      setState(next);
      await setPerson(person, next);
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        aria-pressed={state === "follow"}
        onClick={() => choose("follow")}
        className={cn(
          "h-11 rounded-full border-2 px-5 font-bold",
          state === "follow" ? "border-accent bg-accent text-on-accent" : "border-line hover:bg-soft",
        )}
      >
        {state === "follow" ? "✓ Following" : "Follow"}
      </button>
      <button
        type="button"
        aria-pressed={state === "avoid"}
        onClick={() => choose("avoid")}
        className={cn("h-11 rounded-full border-2 px-5 font-bold", state === "avoid" ? "border-fg bg-fg text-bg" : "border-line hover:bg-soft")}
      >
        {state === "avoid" ? "Avoided" : "Avoid"}
      </button>
    </div>
  );
}

type TitleRef = { id: number; language: string; genreIds: number[]; tags?: string[] };

/**
 * Save it or mark it seen / read, straight from a person's or a list's page.
 * The buttons hold the result themselves (no page refresh, so you keep your place).
 */
export function TitleButtons({ media, title }: { media: "movie" | "series" | "book"; title: TitleRef }) {
  const [state, setState] = useState<"saved" | "seen" | null>(null);
  const [pending, startTransition] = useTransition();
  const markDone = useMarkDone();
  const seenLabel = media === "book" ? "Read it" : "Seen it";

  function act(next: "saved" | "seen") {
    setState(next);
    if (next === "seen") markDone?.(true);
    startTransition(async () => {
      try {
        await (next === "saved" ? saveFromPage(media, title) : seenFromPage(media, title));
      } catch {
        setState(null);
        markDone?.(false);
      }
    });
  }

  if (state) {
    return (
      <span className="rounded-md bg-accent px-2 py-1 text-xs font-bold text-on-accent">
        {state === "saved" ? "Saved" : media === "book" ? "Read" : "Seen"}
      </span>
    );
  }
  const button = "h-9 rounded-full border-2 border-line px-3 text-sm font-bold hover:bg-soft disabled:opacity-60 sm:px-4";
  return (
    <div className="flex gap-1.5">
      <button type="button" disabled={pending} onClick={() => act("seen")} className={button}>
        {seenLabel}
      </button>
      <button type="button" disabled={pending} onClick={() => act("saved")} className={button}>
        Save
      </button>
    </div>
  );
}
