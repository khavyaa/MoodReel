import { ENERGY, MOODS, type MoodId } from "@/lib/moods";

/*
 * The one-line reason shown with tonight's pick, written from facts the app
 * actually has. This is the version that always works; an AI-written line can
 * replace it when available (see lib/ai), but never has to.
 */

export type WhyInput = {
  title: string;
  mood: MoodId;
  energy: 0 | 1 | 2;
  rating: number;
  votes: number;
  runtime: number | null;
  languageLabel: string;
  gate: "crime/thriller" | "acclaimed" | null;
  streamingOn: string[];
  directors: string[];
  beat: number; // how many other saves it beat in the head-to-head
  /** Series only: how big a commitment it is. `runtime` is then the episode length. */
  seasons?: number | null;
  firstSeasonEpisodes?: number | null;
  /** Books only: then `rating` is out of 5 (Open Library) and there's no runtime. */
  book?: { authors: string[]; pages: number | null; nytWeeks: number } | null;
};

export function formatRuntime(minutes: number | null): string | null {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

function votesLabel(votes: number) {
  return votes >= 10000 ? `${Math.round(votes / 1000)}k` : votes.toLocaleString("en-IN");
}

export function ruleBasedWhy(w: WhyInput): string {
  const mood = MOODS[w.mood].label.toLowerCase();
  const energy = ENERGY[w.energy].toLowerCase();
  const opener =
    w.beat > 0
      ? `It beat ${w.beat} other ${w.beat === 1 ? "save" : "saves"} for a ${mood}, ${energy} night`
      : `Your one save for a ${mood}, ${energy} night`;

  const facts: string[] = [];
  if (w.book) {
    const save = w.beat > 0 ? `It beat ${w.beat} other ${w.beat === 1 ? "book" : "books"}` : "Your one save";
    if (w.book.authors[0]) facts.push(`by ${w.book.authors[0]}`);
    if (w.book.pages) facts.push(`${w.book.pages} pages`);
    if (w.book.nytWeeks >= 2) facts.push(`${w.book.nytWeeks} weeks a New York Times bestseller`);
    if (w.votes >= 10) facts.push(`rated ${w.rating.toFixed(1)}/5 by ${votesLabel(w.votes)} Open Library readers`);
    return `${save} for a ${mood}, ${energy} read: ${facts.join(", ")}.`;
  }
  const series = w.seasons != null;
  if (w.gate === "acclaimed") facts.push(`one of the best-rated ${w.languageLabel} ${series ? "shows" : "films"} around`);
  else if (w.gate === "crime/thriller") facts.push(`a ${w.languageLabel} crime pick`);
  facts.push(`rated ${w.rating.toFixed(1)} by ${votesLabel(w.votes)} people on TMDb`);
  if (series) {
    if (w.firstSeasonEpisodes) {
      facts.push(`season 1 is ${w.firstSeasonEpisodes} episodes${w.runtime ? ` of about ${w.runtime} min` : ""}`);
    }
  } else {
    const runtime = formatRuntime(w.runtime);
    if (runtime) facts.push(runtime);
  }

  const where = w.streamingOn.length ? ` It's on ${w.streamingOn[0]}.` : "";
  return `${opener}: ${facts.join(", ")}.${where}`;
}
