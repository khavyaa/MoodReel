"use client";

import { useState, useTransition } from "react";
import { Shuffle } from "lucide-react";
import { pickFromSaved } from "@/app/(app)/library-actions";
import type { LibraryMovie } from "@/lib/library";
import { MEDIA, MOODS, type MoodId } from "@/lib/moods";
import { MAX_SAVES } from "@/lib/deck/finale";
import { AppFrame } from "@/components/shell/app-frame";
import { MovieFlow, type FlowStart } from "@/components/pick/movie-flow";
import { Chip } from "@/components/pick/taps-screen";
import { SavedList } from "./library-lists";

/** Saved films, and "Pick from my saved": the best-fitting few go straight to the head-to-head. */
export function SavedScreen({ movies, total, missing }: { movies: LibraryMovie[]; total: number; missing: number }) {
  const [start, setStart] = useState<FlowStart | null>(null);
  if (start) return <MovieFlow start={start} onExit={() => setStart(null)} />;

  return (
    <AppFrame>
      <div className="flex flex-col gap-10">
        <header className="flex flex-col gap-2">
          <span className="label text-muted">
            Saved · {total} {total === 1 ? "film" : "films"}
          </span>
          <h1 className="display text-[clamp(3rem,7vw,6rem)]">For another night</h1>
        </header>
        {movies.length > 0 && <PickFromSaved onStart={setStart} count={movies.length} />}
        <SavedList movies={movies} />
        {missing > 0 && <p className="text-sm text-muted">{missing} couldn&apos;t load from the movie database just now.</p>}
      </div>
    </AppFrame>
  );
}

function PickFromSaved({ onStart, count }: { onStart: (start: FlowStart) => void; count: number }) {
  const [mood, setMood] = useState<MoodId>("gripping");
  const [time, setTime] = useState<0 | 1 | 2>(2);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const media = MEDIA.movies;

  function go() {
    setError(null);
    startTransition(async () => {
      const result = await pickFromSaved({ mood, time }).catch(() => null);
      if (!result?.ok) {
        setError(result?.error ?? "Couldn't reach the movie database just now. Try again in a moment.");
        return;
      }
      onStart({ sessionId: result.sessionId, cards: result.cards, taps: result.taps, why: result.why });
    });
  }

  return (
    <section aria-labelledby="pick-saved" className="flex flex-col gap-5 rounded-3xl bg-soft p-5 sm:p-7">
      <div className="flex flex-col gap-1">
        <h2 id="pick-saved" className="text-2xl font-black">
          Pick from these
        </h2>
        <p className="text-muted">
          {count === 1
            ? "Only one saved film: if it fits the time, it's tonight's pick."
            : `The ${Math.min(MAX_SAVES, count)} that best fit the mood go head-to-head. No new deck.`}
        </p>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Mood">
        {media.moods.map((id) => (
          <Chip key={id} pressed={mood === id} onClick={() => setMood(id)}>
            <span aria-hidden className="size-3.5 rounded-full" style={{ background: MOODS[id].color }} />
            {MOODS[id].label}
          </Chip>
        ))}
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Time">
        {media.time.map((label, n) => (
          <Chip key={label} pressed={time === n} onClick={() => setTime(n as 0 | 1 | 2)}>
            {label}
          </Chip>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={go}
          disabled={pending}
          className="inline-flex h-13 items-center gap-2 rounded-full bg-accent px-6 font-bold text-on-accent transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          <Shuffle className="size-5" aria-hidden />
          {pending ? "Choosing…" : "Pick from my saved"}
        </button>
        {error && (
          <p role="alert" className="text-sm font-semibold">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
