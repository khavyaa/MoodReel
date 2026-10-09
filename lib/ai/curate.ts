import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import { ENERGY, MEDIA, MOODS } from "@/lib/moods";
import { MOVIE_GENRE_NAMES } from "@/lib/taste/rules";
import { LANGUAGE_LABEL, type MovieCandidate, type Taps } from "@/lib/taste/types";
import { validCuration } from "@/lib/deck/curation";
import { AI_MODEL, aiAvailable, gatewayOptions } from "./gateway";

const MOOD_MEANING: Record<string, string> = {
  gripping: "tense and absorbing: thrillers, crime, mysteries you can't look away from",
  dark: "heavy and morally messy, bleak or disturbing; not uplifting",
  mind: "twisty and puzzling: unreliable narrators, loops, non-linear stories, endings to argue about",
  funny: "genuinely funny comedies for adults; not kids' films",
  feelgood: "warm and uplifting, leaves you lighter; not sad",
  moving: "emotionally affecting drama that lands somewhere real",
  romantic: "a love story at the centre",
};

/**
 * Asks the model which of the top candidates truly fit tonight's taps.
 * Returns approved ids best-first, or null (no AI, timeout, junk answer).
 */
export async function curateWithAi(taps: Taps, candidates: MovieCandidate[]): Promise<number[] | null> {
  if (!aiAvailable() || candidates.length < 10) return null;
  const offered = new Set(candidates.map((c) => c.id));
  const list = candidates
    .map((c) => {
      const genres = c.genreIds.map((g) => MOVIE_GENRE_NAMES[g]).filter(Boolean).join("/");
      return `${c.id} | ${c.title} (${c.year ?? "?"}, ${LANGUAGE_LABEL[c.language] ?? c.language}, ${genres}) | ${c.overview.slice(0, 160)}`;
    })
    .join("\n");

  try {
    const { output } = await generateText({
      model: AI_MODEL,
      providerOptions: gatewayOptions("curate"),
      timeout: 6000,
      maxRetries: 0,
      output: Output.object({ schema: z.object({ approved: z.array(z.number().int()) }) }),
      prompt: [
        `Someone wants a film tonight. Mood: ${MOODS[taps.mood].label} (${MOOD_MEANING[taps.mood]}).`,
        `Energy: ${ENERGY[taps.energy]}. Time: ${MEDIA.movies.time[taps.time]}.`,
        "From the candidates below, return the ids of the ones that genuinely fit this mood and energy,",
        "best fit first. Leave out anything that only matches on genre but not on feel",
        "(e.g. a light caper for 'dark', a sad film for 'feel-good'). Use only ids from the list.",
        "",
        "id | film | synopsis",
        list,
      ].join("\n"),
    });
    return validCuration(output?.approved, offered);
  } catch (error) {
    console.warn("[moodreel] AI curation skipped:", error instanceof Error ? error.message : error);
    return null;
  }
}
