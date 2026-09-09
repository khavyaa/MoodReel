"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EmptyState, MovieGrid } from "@/components/movie-grid";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { loadStates, recordAction } from "@/lib/movie-state-client";
import { readRememberedMovies } from "@/lib/local-store";
import type { MovieCard, MovieState } from "@/lib/types";

type Variant = "watchlist" | "watched";

type ListData = {
  guest: boolean;
  movies: MovieCard[];
  states: Record<number, MovieState>;
};

const COPY: Record<Variant, { title: string; empty: string }> = {
  watchlist: {
    title: "Watchlist",
    empty: "Swipe right on a card to save it here for later.",
  },
  watched: {
    title: "Watched",
    empty: "Swipe up on a card to mark it watched. Watched films stay out of your decks.",
  },
};

async function loadList(variant: Variant): Promise<ListData> {
  const snapshot = await loadStates();
  const ids = Object.values(snapshot.states)
    .filter((s) => (variant === "watchlist" ? s.watchlisted : s.watched))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((s) => s.tmdbMovieId);

  if (ids.length === 0) {
    return { guest: snapshot.guest, movies: [], states: snapshot.states };
  }

  const remembered = readRememberedMovies();
  const fallback = () => ids.map((id) => remembered[id]).filter(Boolean) as MovieCard[];

  try {
    const res = await fetch(`/api/movies/batch?ids=${ids.join(",")}`, { cache: "no-store" });
    if (!res.ok) return { guest: snapshot.guest, movies: fallback(), states: snapshot.states };

    const data = (await res.json()) as { movies: MovieCard[] };
    const byId = new Map(data.movies.map((m) => [m.id, m]));
    return {
      guest: snapshot.guest,
      // Keep the saved order; fall back to the device copy if TMDb dropped one.
      movies: ids.map((id) => byId.get(id) ?? remembered[id]).filter(Boolean) as MovieCard[],
      states: snapshot.states,
    };
  } catch {
    return { guest: snapshot.guest, movies: fallback(), states: snapshot.states };
  }
}

export function SavedList({ variant }: { variant: Variant }) {
  const [reloadCount, setReloadCount] = useState(0);
  const listKey = `${variant}|${reloadCount}`;
  const [result, setResult] = useState<{ key: string; data: ListData } | null>(null);
  const data = result?.key === listKey ? result.data : null;

  useEffect(() => {
    let cancelled = false;
    void loadList(variant).then((loaded) => {
      if (!cancelled) setResult({ key: listKey, data: loaded });
    });
    return () => {
      cancelled = true;
    };
  }, [listKey, variant]);

  function dropMovie(id: number) {
    setResult((prev) =>
      prev ? { ...prev, data: { ...prev.data, movies: prev.data.movies.filter((m) => m.id !== id) } } : prev,
    );
  }

  async function remove(movie: MovieCard) {
    dropMovie(movie.id);
    await recordAction({
      movie,
      action: variant === "watchlist" ? "removed_from_watchlist" : "skipped",
    });
  }

  async function markWatched(movie: MovieCard) {
    dropMovie(movie.id);
    await recordAction({ movie, action: "watched" });
  }

  async function rate(movie: MovieCard, rating: number) {
    setResult((prev) =>
      prev
        ? {
            ...prev,
            data: {
              ...prev.data,
              states: {
                ...prev.data.states,
                [movie.id]: { ...prev.data.states[movie.id], userRating: rating } as MovieState,
              },
            },
          }
        : prev,
    );
    await recordAction({ movie, action: "watched", userRating: rating });
  }

  const copy = COPY[variant];

  return (
    <main className="space-y-6">
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{copy.title}</h1>
          <p className="mt-1 text-xs text-ink-400">
            {data ? `${data.movies.length} ${data.movies.length === 1 ? "film" : "films"}` : "Loading…"}
            {data?.guest && " · stored on this device"}
          </p>
        </div>
        {data && (
          <Button variant="ghost" size="sm" onClick={() => setReloadCount((n) => n + 1)}>
            Refresh
          </Button>
        )}
      </header>

      {!data ? (
        <div className="grid min-h-[40vh] place-items-center">
          <Spinner />
        </div>
      ) : data.movies.length === 0 ? (
        <EmptyState
          title={`Nothing in your ${copy.title.toLowerCase()} yet`}
          body={copy.empty}
          action={
            <Link href="/app">
              <Button>Pick a mood</Button>
            </Link>
          }
        />
      ) : (
        <MovieGrid
          movies={data.movies}
          renderActions={(movie) =>
            variant === "watchlist" ? (
              <div className="flex gap-1.5">
                <Button
                  size="sm"
                  variant="secondary"
                  className="flex-1 px-2"
                  onClick={() => markWatched(movie)}
                >
                  Watched
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="px-2"
                  onClick={() => remove(movie)}
                  aria-label={`Remove ${movie.title} from watchlist`}
                >
                  Remove
                </Button>
              </div>
            ) : (
              <RatingSelect
                value={data.states[movie.id]?.userRating ?? null}
                onChange={(rating) => rate(movie, rating)}
                movieTitle={movie.title}
              />
            )
          }
        />
      )}
    </main>
  );
}

function RatingSelect({
  value,
  onChange,
  movieTitle,
}: {
  value: number | null;
  onChange: (rating: number) => void;
  movieTitle: string;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-ink-400">
      <span className="sr-only">Your rating for {movieTitle}</span>
      <span aria-hidden>Your rating</span>
      <select
        value={value ?? ""}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-8 flex-1 rounded-lg border border-ink-700 bg-ink-900 px-2 text-xs text-ink-100 focus:border-ember-400 focus:outline-none"
      >
        <option value="" disabled>
          —
        </option>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <option key={n} value={n}>
            {n}/10
          </option>
        ))}
      </select>
    </label>
  );
}
