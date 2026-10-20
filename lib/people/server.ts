import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { peoplePrefs } from "@/lib/db/schema";
import { NO_PEOPLE, type PeopleFilter } from "./rules";
import { authorPhoto, personKey, tmdbPhoto, type Person, type PersonSource, type PhotoRef } from "./types";
import { tmdbPersonPhoto } from "@/lib/tmdb/people";

export type PersonPref = "follow" | "avoid" | "dismissed";

export async function peoplePrefsFor(userId: string) {
  const rows = await getDb()
    .select()
    .from(peoplePrefs)
    .where(eq(peoplePrefs.userId, userId))
    .orderBy(desc(peoplePrefs.updatedAt));
  return rows.map((r) => ({
    person: { source: r.source as PersonSource, id: Number(r.personId), name: r.name, role: r.role as Person["role"] },
    kind: r.kind as PersonPref,
  }));
}

/** Follows and avoids, in the shape the deck builders take. */
export async function peopleFilterFor(userId: string): Promise<PeopleFilter> {
  const prefs = await peoplePrefsFor(userId).catch(() => null);
  if (!prefs) return NO_PEOPLE;
  return {
    follow: new Map(prefs.filter((p) => p.kind === "follow").map((p) => [personKey(p.person), p.person.name])),
    avoid: new Set(prefs.filter((p) => p.kind === "avoid").map((p) => personKey(p.person))),
  };
}

/** Follow, avoid, turn down a suggestion, or (null) clear it. */
export async function setPersonPref(userId: string, person: Person, kind: PersonPref | null) {
  const db = getDb();
  const key = and(
    eq(peoplePrefs.userId, userId),
    eq(peoplePrefs.source, person.source),
    eq(peoplePrefs.personId, String(person.id)),
  );
  if (kind === null) {
    await db.delete(peoplePrefs).where(key);
    return;
  }
  await db
    .insert(peoplePrefs)
    .values({ userId, source: person.source, personId: String(person.id), name: person.name, role: person.role, kind })
    .onConflictDoUpdate({
      target: [peoplePrefs.userId, peoplePrefs.source, peoplePrefs.personId],
      set: { kind, name: person.name, role: person.role, updatedAt: new Date() },
    });
}

/** Photos for a list of people: TMDb profiles (looked up, cached for a week) or Open Library author photos. */
export async function photosFor(people: Person[]): Promise<Map<string, PhotoRef>> {
  const found = await Promise.all(
    people.slice(0, 60).map(async (p) => [personKey(p), p.source === "tmdb" ? tmdbPhoto(await tmdbPersonPhoto(p.id)) : authorPhoto(p.id)] as const),
  );
  return new Map(found);
}
