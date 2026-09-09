"use client";

import { useEffect, useState } from "react";
import { Bookmark, BookmarkCheck, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loadStates, recordAction } from "@/lib/movie-state-client";
import { emptyMovieState, type MovieCard, type MovieState } from "@/lib/types";

/** Watchlist / watched / skip controls, mirrored from the swipe gestures. */
export function MovieActions({ movie }: { movie: MovieCard }) {
  const [state, setState] = useState<MovieState>(() => emptyMovieState(movie.id));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void loadStates().then(({ states }) => {
      if (active && states[movie.id]) setState(states[movie.id]);
    });
    return () => {
      active = false;
    };
  }, [movie.id]);

  async function run(action: Parameters<typeof recordAction>[0]["action"]) {
    setBusy(true);
    const next = await recordAction({ movie, action });
    setState(next);
    setBusy(false);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        onClick={() => run(state.watchlisted ? "removed_from_watchlist" : "liked")}
        disabled={busy}
        variant={state.watchlisted ? "secondary" : "primary"}
      >
        {state.watchlisted ? (
          <>
            <BookmarkCheck className="size-4" aria-hidden /> In watchlist
          </>
        ) : (
          <>
            <Bookmark className="size-4" aria-hidden /> Watchlist
          </>
        )}
      </Button>
      <Button onClick={() => run("watched")} disabled={busy || state.watched} variant="secondary">
        <Check className="size-4" aria-hidden />
        {state.watched ? "Watched" : "Mark watched"}
      </Button>
      <Button onClick={() => run("skipped")} disabled={busy} variant="ghost">
        <X className="size-4" aria-hidden /> Not for me
      </Button>
    </div>
  );
}
