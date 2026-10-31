"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import { notForMeFromPage, saveFromPage, seenFromPage, setPerson } from "@/app/(app)/people-actions";
import { rateTitle, undoLibrary } from "@/app/(app)/library-actions";
import { useToast } from "@/components/ui/toast";
import { StarPrompt } from "@/components/flow/star-prompt";
import type { Person } from "@/lib/people/types";
import { cn } from "@/lib/cn";
import { useAdvance, useMarkDone } from "@/components/flow/cover-flow";

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
          // Following is a state, not the page's main action (Deal is): outlined, with a tick.
          state === "follow" ? "border-fg" : "border-line hover:bg-soft",
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
 * Seen it, Save or Not for me, straight from a person's, a list's or a
 * collection's page. Seen it asks for stars (or Skip) first; each then moves
 * the flow on to the next card. The buttons hold the result themselves (no
 * page refresh, so you keep your place).
 */
export function TitleButtons({ media, title, label }: { media: "movie" | "series" | "book"; title: TitleRef; label: string }) {
  const [state, setState] = useState<"saved" | "seen" | "rating" | "disliked" | null>(null);
  const [stars, setStars] = useState(0);
  const [pending, startTransition] = useTransition();
  const markDone = useMarkDone();
  const advance = useAdvance();
  const toast = useToast();
  const sent = useRef<Promise<unknown>>(Promise.resolve());
  const book = media === "book";

  /** The Undo toast after Seen it / Read it or Not for me: back to how it was, buttons and all. */
  function offerUndo(kind: "seen" | "disliked") {
    toast({
      message: kind === "seen" ? `${book ? "Read" : "Seen"}: ${label}` : `Not for me: ${label}`,
      undone: `${label} is back as it was`,
      undo: async () => {
        await sent.current.catch(() => undefined);
        await undoLibrary({ media, id: title.id, kind });
        setState(null);
        setStars(0);
        if (kind === "seen") markDone?.(false);
      },
    });
  }

  function act(next: "saved" | "seen" | "disliked") {
    setState(next === "seen" ? "rating" : next);
    if (next === "seen") markDone?.(true);
    else advance?.();
    const call = next === "saved" ? saveFromPage(media, title) : next === "seen" ? seenFromPage(media, title) : notForMeFromPage(media, title);
    sent.current = call;
    if (next === "disliked") offerUndo("disliked");
    startTransition(async () => {
      try {
        await call;
      } catch {
        setState(null);
        if (next === "seen") markDone?.(false);
      }
    });
  }

  if (state === "rating") {
    return (
      <StarPrompt
        title={label}
        onRate={(n) => {
          setStars(n);
          void sent.current.then(() => rateTitle(media, title.id, n)).catch(() => setStars(0));
        }}
        onDone={() => {
          setState("seen");
          offerUndo("seen");
          advance?.();
        }}
      />
    );
  }
  if (state) {
    return (
      <span className="rounded-md bg-accent px-2 py-1 text-xs font-bold text-on-accent">
        {state === "saved" ? "Saved" : state === "disliked" ? "Not for me" : `${book ? "Read" : "Seen"}${stars ? ` ${"★".repeat(stars)}` : ""}`}
      </span>
    );
  }
  const button = "min-h-11 rounded-full border-2 border-line px-4 text-sm font-bold hover:bg-soft disabled:opacity-60";
  return (
    <div className="flex flex-wrap justify-center gap-1.5">
      <button type="button" disabled={pending} onClick={() => act("seen")} className={cn(button, "border-accent bg-accent text-on-accent")}>
        {book ? "Read it" : "Seen it"}
      </button>
      <button type="button" disabled={pending} onClick={() => act("saved")} className={button}>
        Save
      </button>
      <button type="button" disabled={pending} onClick={() => act("disliked")} className={button}>
        Not for me
      </button>
    </div>
  );
}
