"use client";

import { useOptimistic, useTransition } from "react";
import { setPerson, saveFromPage } from "@/app/(app)/people-actions";
import type { Person } from "@/lib/people/types";
import { cn } from "@/lib/cn";

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

/** Save one title straight from a person's page. */
export function SaveButton({
  media,
  title,
}: {
  media: "movie" | "series" | "book";
  title: { id: number; language: string; genreIds: number[]; tags?: string[] };
}) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useOptimistic(false);
  if (saved) return <span className="rounded-md bg-accent px-2 py-1 text-xs font-bold text-on-accent">Saved</span>;
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          setSaved(true);
          await saveFromPage(media, title);
        })
      }
      className="h-9 rounded-full border-2 border-line px-4 text-sm font-bold hover:bg-soft"
    >
      Save
    </button>
  );
}
