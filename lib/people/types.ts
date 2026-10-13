/*
 * People: directors, writers and lead actors (TMDb, shared by films and
 * series) and authors (Open Library). Keyed by source and id, like titles.
 */

export type PersonSource = "tmdb" | "openlibrary";
export type PersonRole = "director" | "creator" | "writer" | "actor" | "author";

export type Person = { source: PersonSource; id: number; name: string; role: PersonRole };

export const personKey = (p: { source: PersonSource; id: number }) => `${p.source}:${p.id}`;

/** URL path for a person's page. */
export const personHref = (p: { source: PersonSource; id: number }) =>
  `/people/${p.source === "tmdb" ? "tmdb" : "ol"}/${p.id}`;

/** A person in a URL or form value: "tmdb:525" or "openlibrary:1234". */
export function parsePersonKey(value: string | null | undefined): { source: PersonSource; id: number } | null {
  const m = value?.match(/^(tmdb|openlibrary):(\d+)$/);
  return m ? { source: m[1] as PersonSource, id: Number(m[2]) } : null;
}

/** Writing credits worth naming on a card. */
export const WRITING_JOBS = new Set(["Screenplay", "Writer", "Story", "Novel", "Teleplay"]);
