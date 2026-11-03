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
  profile_path?: string | null;
  known_for_department?: string;
  movie_credits?: { cast: (TmdbMovie & Credit)[]; crew: (TmdbMovie & Credit)[] };
  tv_credits?: { cast: (TmdbShow & Credit)[]; crew: (TmdbShow & Credit)[] };
};

export type PersonWork = { candidate: MovieCandidate; role: PersonRole };

export type TmdbPerson = {
  id: number;
  name: string;
  /** Their TMDb profile photo ("/abc.jpg"), if TMDb has one. */
  photo: string | null;
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
    photo: p.profile_path ?? null,
    role: roleFromDepartment(p.known_for_department),
    movies: collect(p.movie_credits?.cast ?? [], p.movie_credits?.crew ?? [], (m) => movieCandidate(m, false), new Set()),
    series: collect(p.tv_credits?.cast ?? [], p.tv_credits?.crew ?? [], (s) => showCandidate(s, false), new Set(["Creator"])),
  };
}

/** People matching a name, for "with someone in mind?" and the People page's search. */
export async function searchTmdbPeople(query: string): Promise<{ id: number; name: string; detail: string; photo: string | null }[]> {
  const data = await tmdb<{
    results: {
      id: number;
      name: string;
      profile_path?: string | null;
      known_for_department?: string;
      known_for?: { title?: string; name?: string }[];
    }[];
  }>("/search/person", { query, language: "en-US", include_adult: false }, 60 * 60);
  return data.results.slice(0, 8).map((p) => {
    // Up to three titles, so two people with the same name can be told apart.
    const known = p.known_for?.map((k) => k.title ?? k.name).filter(Boolean).slice(0, 3).join(", ");
    const dept = p.known_for_department === "Directing" ? "director" : p.known_for_department === "Writing" ? "writer" : "actor";
    return { id: p.id, name: p.name, detail: known ? `${dept} · ${known}` : dept, photo: p.profile_path ?? null };
  });
}

/** Just a person's photo, for lists of people (cached for a week). Null when TMDb has none or can't say. */
export async function tmdbPersonPhoto(id: number): Promise<string | null> {
  const p = await tmdb<{ profile_path?: string | null }>(`/person/${id}`, { language: "en-US" }, 60 * 60 * 24 * 7).catch(() => null);
  return p?.profile_path ?? null;
}
