import { personKey, type Person } from "./types";

/*
 * What following and avoiding do to a deck. Pure, so it's unit-tested.
 *
 * - Avoid: anything with an avoided person among its directors, creators,
 *   writers, lead actors or authors is dropped.
 * - Follow: a followed person's work gets a boost, and the card says why.
 */

export type PeopleFilter = { follow: Map<string, string>; avoid: Set<string> };
export const NO_PEOPLE: PeopleFilter = { follow: new Map(), avoid: new Set() };

/** Score added for a followed person: about as much as a strong mood fit. */
export const FOLLOW_BOOST = 0.15;

export function avoided(people: Person[], filter: PeopleFilter): boolean {
  return people.some((p) => filter.avoid.has(personKey(p)));
}

/** The first followed person on a title, for the card's badge. */
export function followedIn(people: Person[], filter: PeopleFilter): string | null {
  for (const p of people) {
    const name = filter.follow.get(personKey(p));
    if (name) return name;
  }
  return null;
}

/**
 * Drops avoided people's work and boosts followed people's. `preBoosted` items
 * (a followed person's work added to the pool, boosted before shortlisting so
 * it isn't cut early) aren't boosted twice.
 */
export function applyPeople<T extends { score: number }>(
  items: T[],
  peopleOf: (item: T) => Person[] | null,
  filter: PeopleFilter,
  preBoosted: (item: T) => boolean = () => false,
): T[] {
  if (!filter.avoid.size && !filter.follow.size) return items;
  return items.flatMap((item) => {
    const people = peopleOf(item);
    if (!people) return [item];
    if (avoided(people, filter)) return [];
    const boost = followedIn(people, filter) && !preBoosted(item);
    return [boost ? { ...item, score: item.score + FOLLOW_BOOST } : item];
  });
}

/** At most this many followed people's titles in one deck, and per person, so a deck stays a mix. */
export const MAX_FOLLOWED = 4;
export const MAX_PER_FOLLOWED = 2;

/** Keeps the best few followed-people titles, a couple per person; input best-first. */
export function capFollowed<T>(ranked: T[], followedNameOf: (item: T) => string | null, max = MAX_FOLLOWED): T[] {
  let kept = 0;
  const perPerson = new Map<string, number>();
  return ranked.filter((item) => {
    const name = followedNameOf(item);
    if (!name) return true;
    const n = perPerson.get(name) ?? 0;
    if (kept >= max || n >= MAX_PER_FOLLOWED) return false;
    perPerson.set(name, n + 1);
    kept++;
    return true;
  });
}

/** How many loved titles it takes before someone is suggested. */
export const SUGGEST_AFTER = 3;

/**
 * People who keep turning up in what you've loved (saved, picked, finished or
 * rated four stars and up), not already followed, avoided or turned down.
 * Actors need one more title than directors, writers and authors: a lead actor
 * appears in a lot of films without being why you liked them.
 */
export function suggestPeople(
  loved: { people: Person[] }[],
  known: Set<string>,
  limit = 3,
): { person: Person; count: number }[] {
  const counts = new Map<string, { person: Person; count: number }>();
  for (const title of loved) {
    const once = new Set<string>();
    for (const p of title.people) {
      const key = personKey(p);
      if (known.has(key) || once.has(key)) continue;
      once.add(key);
      const entry = counts.get(key) ?? { person: p, count: 0 };
      entry.count++;
      // Prefer the role that isn't "actor" when someone both acts and directs.
      if (entry.person.role === "actor" && p.role !== "actor") entry.person = p;
      counts.set(key, entry);
    }
  }
  return [...counts.values()]
    .filter((e) => e.count >= SUGGEST_AFTER + (e.person.role === "actor" ? 1 : 0))
    .sort((a, b) => b.count - a.count || a.person.name.localeCompare(b.person.name))
    .slice(0, limit);
}
