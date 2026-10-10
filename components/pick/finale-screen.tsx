"use client";

import { useEffect } from "react";
import { Undo2 } from "lucide-react";
import type { DeckCard } from "@/lib/deck/build-movies";
import type { Finale } from "@/lib/deck/finale";
import { cardMeta } from "@/lib/card-meta";
import { Poster } from "./poster";

/** "This or that?" Laptop: side by side with ← / →. iPhone: stacked, tap one. */
export function FinaleScreen({
  finale,
  onChoose,
  onBack,
  fromSaved,
}: {
  finale: Finale<DeckCard>;
  onChoose: (side: "champion" | "challenger") => void;
  /** Undo the save that ended the deck and go back to it. Only before the first round is chosen. */
  onBack: (() => void) | null;
  fromSaved: boolean;
}) {
  const left = finale.champion;
  const right = finale.challengers[0];

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowLeft") onChoose("champion");
      if (e.key === "ArrowRight") onChoose("challenger");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onChoose]);

  return (
    <div className="flex flex-1 flex-col gap-6 lg:gap-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="display text-[clamp(3rem,8vw,7rem)]">This or that?</h1>
        <p className="label text-muted">
          {fromSaved && "From your saved list · "}Round {finale.round} of {finale.rounds}
        </p>
      </div>
      <div className="grid flex-1 items-center gap-3 lg:grid-cols-[1fr_auto_1fr] lg:gap-8">
        <Option card={left} onPick={() => onChoose("champion")} keyHint="←" />
        <span className="display text-center text-3xl opacity-60 lg:text-5xl" aria-hidden>
          or
        </span>
        <Option card={right} onPick={() => onChoose("challenger")} keyHint="→" />
      </div>
      <div className="flex items-center justify-between gap-4">
        <p className="hidden text-sm text-muted lg:block">Keys: ← for the left, → for the right.</p>
        {onBack && finale.round === 1 && (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-bold underline-offset-4 hover:underline"
          >
            <Undo2 className="size-4" aria-hidden /> Back to the deck
          </button>
        )}
      </div>
    </div>
  );
}

function Option({ card, onPick, keyHint }: { card: DeckCard; onPick: () => void; keyHint: string }) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-label={`Choose ${card.title}`}
      className="group grid grid-cols-[96px_minmax(0,1fr)] items-center gap-4 rounded-3xl border-2 border-line bg-soft p-3 text-left transition-[transform,border-color] hover:-translate-y-1 hover:border-accent sm:grid-cols-[140px_minmax(0,1fr)] lg:grid-cols-[minmax(160px,220px)_minmax(0,1fr)] lg:gap-6 lg:p-5"
    >
      <Poster title={card.title} path={card.posterPath} size="md" sizes="(min-width: 1024px) 220px, 140px" />
      <span className="flex min-w-0 flex-col gap-2">
        <span className="display text-[clamp(1.75rem,3.2vw,3rem)]">{card.title}</span>
        <span className="label text-muted">
          {cardMeta(card)}
        </span>
        <span className="hidden text-sm lg:line-clamp-3">{card.overview}</span>
        <span className="hidden text-sm font-semibold opacity-60 lg:block">Press {keyHint}</span>
      </span>
    </button>
  );
}
