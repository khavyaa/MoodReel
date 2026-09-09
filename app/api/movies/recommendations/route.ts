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

const DECK_SIZE = 40;
const PAGES_PER_LANGUAGE = 2;

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
    const requests = languages.flatMap((language) =>
      Array.from({ length: PAGES_PER_LANGUAGE }, (_, i) =>
        discoverMovies({ language, preset, page: (page - 1) * PAGES_PER_LANGUAGE + i + 1 }),
      ),
    );

    const settled = await Promise.allSettled(requests);
    const failure = settled.find((r) => r.status === "rejected");
    const fulfilled = settled.filter(
      (r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof discoverMovies>>> =>
        r.status === "fulfilled",
    );
    // Every language failed - surface the real TMDb error instead of an empty deck.
    if (fulfilled.length === 0 && failure && failure.status === "rejected") {
      throw failure.reason;
    }

    const merged = dedupeMovies(fulfilled.flatMap((r) => r.value));
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
      movies: deck,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
