"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { SwipeDeck } from "@/components/swipe-deck";
import { EmptyState } from "@/components/movie-grid";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { MOOD_PRESETS, isMoodId, type MoodId } from "@/lib/recommendations/mood-presets";
import { readLocalStates } from "@/lib/local-store";
import { updatePreferences, usePreferences } from "@/lib/use-preferences";
import { recordAction } from "@/lib/movie-state-client";
import type { LanguageCode, MovieActionType, MovieCard } from "@/lib/types";

type DeckResult =
  | { status: "ready"; movies: MovieCard[] }
  | { status: "error"; message: string; code?: string };

const ACTION_LABEL: Partial<Record<MovieActionType, string>> = {
  liked: "Added to watchlist",
  skipped: "Skipped",
  watched: "Marked as watched",
};

async function fetchDeck(
  mood: MoodId,
  languages: LanguageCode[],
  page: number,
): Promise<DeckResult> {
  // Guests have no server-side history, so their local ids ride along.
  const excludeIds = Object.values(readLocalStates())
    .filter((s) => s.watched || s.skipped || s.disliked || s.watchlisted)
    .map((s) => s.tmdbMovieId)
    .slice(0, 400);

  const query = new URLSearchParams({
    mood,
    languages: languages.join(","),
    page: String(page),
  });
  if (excludeIds.length) query.set("exclude", excludeIds.join(","));

  try {
    const res = await fetch(`/api/movies/recommendations?${query}`, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) {
      return { status: "error", message: data.error ?? "Could not load movies.", code: data.code };
    }
    return { status: "ready", movies: data.movies as MovieCard[] };
  } catch {
    return {
      status: "error",
      message: "Could not reach the server. Check your connection and try again.",
    };
  }
}

export function DeckClient() {
  const router = useRouter();
  const params = useSearchParams();
  const preferences = usePreferences();

  const moodParam = params.get("mood");
  const mood: MoodId | null = isMoodId(moodParam) ? moodParam : null;
  // Memoised on the joined string, not the array, so an equal list keeps its identity.
  const languageParam = params.get("languages") ?? preferences.languages.join(",");
  const languages = useMemo<LanguageCode[]>(() => {
    const parsed = languageParam
      .split(",")
      .filter((l): l is LanguageCode => l === "en" || l === "hi" || l === "ta");
    return parsed.length ? parsed : (["en", "hi", "ta"] as LanguageCode[]);
  }, [languageParam]);

  const [page, setPage] = useState(1);
  const [reloadCount, setReloadCount] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The result carries the request it answers, so "loading" is derived rather
  // than written from inside the effect.
  const deckKey = `${mood}|${languages.join(",")}|${page}|${reloadCount}`;
  const [result, setResult] = useState<{ key: string; value: DeckResult } | null>(null);
  const state = result?.key === deckKey ? result.value : null;

  useEffect(() => {
    if (!mood) return;
    let cancelled = false;
    void fetchDeck(mood, languages, page).then((value) => {
      if (!cancelled) setResult({ key: deckKey, value });
    });
    return () => {
      cancelled = true;
    };
  }, [deckKey, languages, mood, page]);

  useEffect(() => {
    if (mood) updatePreferences({ lastMood: mood, languages });
  }, [languages, mood]);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  function showToast(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1600);
  }

  function handleAction(movie: MovieCard, action: MovieActionType) {
    void recordAction({ movie, action, mood });
    const label = ACTION_LABEL[action];
    if (label) showToast(label);
  }

  if (!mood) {
    return (
      <EmptyState
        title="Pick a mood first"
        body="Every deck starts from a mood, so MoodReel knows what kind of night this is."
        action={
          <Link href="/app">
            <Button>Choose a mood</Button>
          </Link>
        }
      />
    );
  }

  const preset = MOOD_PRESETS[mood];

  return (
    <main className="flex flex-col gap-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            <span aria-hidden className="mr-1.5">
              {preset.emoji}
            </span>
            {preset.label}
          </h1>
          <p className="mt-1 text-xs text-ink-400">
            {languages.map((l) => l.toUpperCase()).join(" · ")} · page {page}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setReloadCount((n) => n + 1)}
            aria-label="Reshuffle this deck"
          >
            <RefreshCw className="size-4" aria-hidden />
          </Button>
          <Link href="/app">
            <Button variant="secondary" size="sm">
              Change mood
            </Button>
          </Link>
        </div>
      </header>

      {state === null && (
        <div className="flex aspect-[2/3] w-full max-w-sm animate-pulse items-center justify-center self-center rounded-3xl border border-ink-800 bg-ink-900">
          <Spinner />
        </div>
      )}

      {state?.status === "error" && (
        <EmptyState
          title={
            state.code === "tmdb_not_configured" ? "TMDb is not configured" : "Deck failed to load"
          }
          body={
            state.code === "tmdb_not_configured"
              ? "Add a TMDB_ACCESS_TOKEN to the server environment and restart the app to see recommendations."
              : state.message
          }
          action={<Button onClick={() => setReloadCount((n) => n + 1)}>Try again</Button>}
        />
      )}

      {state?.status === "ready" &&
        (state.movies.length === 0 ? (
          <EmptyState
            title="You have seen everything here"
            body="This mood and language mix has no fresh films left. Try another mood, add a language, or load the next page."
            action={<Button onClick={() => setPage((p) => p + 1)}>Load more</Button>}
          />
        ) : (
          <SwipeDeck
            key={deckKey}
            movies={state.movies}
            onAction={handleAction}
            onOpenDetails={(movie) => router.push(`/app/movie/${movie.id}`)}
            onExhausted={() => setPage((p) => p + 1)}
          />
        ))}

      <div aria-live="polite" className="h-6 text-center text-sm text-ember-300">
        {toast}
      </div>
    </main>
  );
}
