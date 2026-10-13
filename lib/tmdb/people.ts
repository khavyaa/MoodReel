import "server-only";
import { tmdb } from "./client";
import { toCandidate as movieCandidate, type TmdbMovie } from "./movies";
import { toCandidate as showCandidate, type TmdbShow } from "./series";
import { WRITING_JOBS, type PersonRole } from "@/lib/people/types";
import type { MovieCandidate } from "@/lib/taste/types";

/*
 * A TMDb person and their work. TMDb people are shared by films and series,
 * so one page lists both.
 */

type Credit = { order?: number; job?: string; department?: string };
type PersonResponse = {
  id: number;
  name: string;
  known_for_department?: string;
  movie_credits?: { cast: (TmdbMovie & Credit)[]; crew: (TmdbMovie & Credit)[] };
  tv_credits?: { cast: (TmdbShow & Credit)[]; crew: (TmdbShow & Credit)[] };
};

export type PersonWork = { candidate: MovieCandidate; role: PersonRole };

export type TmdbPerson = {
  id: number;
  name: string;
  role: PersonRole;
  movies: PersonWork[];
  series: PersonWork[];
};

/** Lead roles only: in the top six billed. */
const LEAD = 6;

function roleFromDepartment(dept: string | undefined): PersonRole {
  if (dept === "Directing") return "director";
  if (dept === "Writing") return "writer";
  return "actor";
}

function collect<T extends Credit>(
  cast: T[],
  crew: T[],
  toCandidate: (x: T) => MovieCandidate,
  creatorJobs: Set<string>,
): PersonWork[] {
  const works = new Map<number, PersonWork>();
  for (const c of crew) {
    const job = c.job ?? "";
    const role: PersonRole | null =
      job === "Director" ? "director" : creatorJobs.has(job) ? "creator" : WRITING_JOBS.has(job) ? "writer" : null;
    if (!role) continue;
    const candidate = toCandidate(c);
    if (!works.has(candidate.id)) works.set(candidate.id, { candidate, role });
  }
  for (const c of cast) {
    if ((c.order ?? 99) >= LEAD) continue;
    const candidate = toCandidate(c);
    if (!works.has(candidate.id)) works.set(candidate.id, { candidate, role: "actor" });
  }
  return [...works.values()].sort((a, b) => b.candidate.voteCount - a.candidate.voteCount);
}

export async function getTmdbPerson(id: number): Promise<TmdbPerson> {
  const p = await tmdb<PersonResponse>(
    `/person/${id}`,
    { language: "en-US", append_to_response: "movie_credits,tv_credits" },
    60 * 60 * 12,
  );
  return {
    id: p.id,
    name: p.name,
    role: roleFromDepartment(p.known_for_department),
    movies: collect(p.movie_credits?.cast ?? [], p.movie_credits?.crew ?? [], (m) => movieCandidate(m, false), new Set()),
    series: collect(p.tv_credits?.cast ?? [], p.tv_credits?.crew ?? [], (s) => showCandidate(s, false), new Set(["Creator"])),
  };
}

/** People matching a name, for "with someone in mind?". */
export async function searchTmdbPeople(query: string): Promise<{ id: number; name: string; detail: string }[]> {
  const data = await tmdb<{
    results: { id: number; name: string; known_for_department?: string; known_for?: { title?: string; name?: string }[] }[];
  }>("/search/person", { query, language: "en-US", include_adult: false }, 60 * 60);
  return data.results.slice(0, 8).map((p) => {
    const known = p.known_for?.map((k) => k.title ?? k.name).filter(Boolean)[0];
    const dept = p.known_for_department === "Directing" ? "director" : p.known_for_department === "Writing" ? "writer" : "actor";
    return { id: p.id, name: p.name, detail: known ? `${dept} · ${known}` : dept };
  });
}
