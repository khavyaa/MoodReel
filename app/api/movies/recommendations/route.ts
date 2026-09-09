import { NextResponse, type NextRequest } from "next/server";
import { discoverMovies } from "@/lib/tmdb";
import { MOOD_PRESETS, isMoodId } from "@/lib/recommendations/mood-presets";
import {
  dedupeMovies,
  interleaveByLanguage,
  rankMovies,
} from "@/lib/recommendations/rank-movies";
import { filterSeen, statesToMap } from "@/lib/recommendations/filter-seen";
import { handleRouteError, jsonError, parseIdList, parseLanguages } from "@/lib/api";
import { loadUserContext } from "@/lib/movie-states-server";
import { createClient } from "@/lib/supabase/server";
import type { LanguageCode, MovieCard } from "@/lib/types";

const DECK_SIZE = 40;
const PAGES_PER_LANGUAGE = 2;

/** One discover request's outcome, tagged so failures can be attributed to a language. */
type DiscoverOutcome =
  | { ok: true; language: LanguageCode; movies: MovieCard[] }
  | { ok: false; language: LanguageCode; error: unknown };

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const mood = params.get("mood");
    if (!isMoodId(mood)) {
      return jsonError(`Unknown mood "${mood ?? ""}".`, 400, { code: "invalid_mood" });
    }

    const languages = parseLanguages(params.get("languages"));
    const page = Math.max(1, Math.min(Number(params.get("page") ?? 1) || 1, 20));
    const excludeIds = parseIdList(params.get("exclude"));
    const seed = Number(params.get("seed")) || Math.floor(Date.now() / 60000);

    const preset = MOOD_PRESETS[mood];
    const { userId, states, taste } = await loadUserContext();

    // One discover call per language per page; TMDb has no multi-language filter.
    // Each result is tagged with its language so a failure can be attributed to
    // one, rather than silently thinning the deck.
    const requests: Promise<DiscoverOutcome>[] = languages.flatMap((language) =>
      Array.from({ length: PAGES_PER_LANGUAGE }, (_, i) =>
        discoverMovies({ language, preset, page: (page - 1) * PAGES_PER_LANGUAGE + i + 1 })
          .then((movies): DiscoverOutcome => ({ ok: true, language, movies }))
          .catch((error: unknown): DiscoverOutcome => ({ ok: false, language, error })),
      ),
    );

    const results = await Promise.all(requests);
    const succeeded = results.filter((r) => r.ok);
    const failures = results.filter((r) => !r.ok);

    // Every request failed - surface the real TMDb error instead of an empty deck.
    if (succeeded.length === 0) {
      throw failures[0]?.error ?? new Error("No TMDb results.");
    }

    // Only a language whose every request failed is "missing". A language that
    // simply has no titles matching this mood is a thin result, not an error.
    const failedLanguages = languages.filter(
      (language) =>
        failures.some((f) => f.language === language) &&
        !succeeded.some((r) => r.language === language),
    );
    if (failures.length > 0) {
      console.warn(
        `[moodreel] ${failures.length}/${results.length} TMDb discover requests failed` +
          (failedLanguages.length ? `; lost languages: ${failedLanguages.join(", ")}` : ""),
        failures[0].error,
      );
    }

    const merged = dedupeMovies(succeeded.flatMap((r) => r.movies));
    const unseen = filterSeen(merged, statesToMap(states), { excludeIds });
    const ranked = rankMovies(unseen, preset, taste, seed);
    const deck = interleaveByLanguage(ranked).slice(0, DECK_SIZE);

    if (userId && page === 1) {
      const supabase = await createClient();
      // Session logging is best-effort telemetry; never fail the deck over it.
      await supabase
        ?.from("mood_sessions")
        .insert({ user_id: userId, mood, languages, filters: { page, seed } });
    }

    return NextResponse.json({
      mood,
      languages,
      page,
      seed,
      count: deck.length,
      // Tells the client this deck is missing languages it asked for.
      partial: failedLanguages.length > 0,
      missingLanguages: failedLanguages,
      movies: deck,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
