import { describe, expect, it } from "vitest";
import { FOLLOW_BOOST, NO_PEOPLE, applyPeople, capFollowed, followedIn, suggestPeople, type PeopleFilter } from "@/lib/people/rules";
import { parsePersonKey, personHref, personKey, type Person } from "@/lib/people/types";
import { moviePeople } from "@/lib/tmdb/movies";

const p = (id: number, role: Person["role"] = "director", name = `P${id}`): Person => ({ source: "tmdb", id, name, role });

describe("follow and avoid", () => {
  const filter: PeopleFilter = { follow: new Map([[personKey(p(1)), "P1"]]), avoid: new Set([personKey(p(2))]) };
  const items = [
    { id: "followed", score: 0.5, people: [p(1), p(9, "actor")] },
    { id: "avoided", score: 0.9, people: [p(3), p(2, "actor")] },
    { id: "plain", score: 0.6, people: [p(4)] },
    { id: "unknown", score: 0.7, people: null },
  ];

  it("drops anything with an avoided person, even as an actor", () => {
    const kept = applyPeople(items, (i) => i.people, filter).map((i) => i.id);
    expect(kept).toEqual(["followed", "plain", "unknown"]);
  });

  it("boosts a followed person's work and names them for the badge", () => {
    const followed = applyPeople(items, (i) => i.people, filter).find((i) => i.id === "followed")!;
    expect(followed.score).toBeCloseTo(0.5 + FOLLOW_BOOST);
    expect(followedIn(items[0].people!, filter)).toBe("P1");
    expect(followedIn(items[2].people!, filter)).toBeNull();
  });

  it("changes nothing with no follows or avoids", () => {
    expect(applyPeople(items, (i) => i.people, NO_PEOPLE)).toBe(items);
  });
});

describe("capping followed work", () => {
  it("keeps at most four followed titles, two per person, and everything else", () => {
    const items = ["N1", "N2", "N3", "V1", "x", "V2", "V3", "W1", "y"];
    const who = (i: string) => (i.startsWith("N") ? "Nolan" : i.startsWith("V") ? "Villeneuve" : i.startsWith("W") ? "Weir" : null);
    expect(capFollowed(items, who)).toEqual(["N1", "N2", "V1", "x", "V2", "y"]);
  });
});

describe("suggestions", () => {
  it("suggests someone after three loved titles, an actor after four, never someone already known", () => {
    const loved = [
      { people: [p(1), p(5, "actor")] },
      { people: [p(1), p(5, "actor")] },
      { people: [p(1), p(5, "actor"), p(6)] },
      { people: [p(6), p(6, "actor")] }, // the same person twice in one title counts once
    ];
    expect(suggestPeople(loved, new Set()).map((s) => s.person.id)).toEqual([1]);
    // Most-loved first: the actor now has four titles, the director three.
    expect(suggestPeople([...loved, { people: [p(5, "actor")] }], new Set()).map((s) => s.person.id)).toEqual([5, 1]);
    expect(suggestPeople(loved, new Set([personKey(p(1))]))).toEqual([]);
  });
});

describe("people on a film", () => {
  it("directors, up to two writers, three leads, each once", () => {
    const people = moviePeople({
      crew: [
        { id: 1, name: "Dir", job: "Director" },
        { id: 2, name: "W1", job: "Screenplay" },
        { id: 3, name: "W2", job: "Story" },
        { id: 4, name: "W3", job: "Writer" },
        { id: 9, name: "Editor", job: "Editor" },
      ],
      cast: [
        { id: 1, name: "Dir" }, // directs and acts: listed once, as director
        { id: 5, name: "A1" },
        { id: 6, name: "A2" },
        { id: 7, name: "A3" },
      ],
    });
    expect(people.map((x) => `${x.role}:${x.id}`)).toEqual(["director:1", "writer:2", "writer:3", "actor:5", "actor:6"]);
  });

  it("keys and links people", () => {
    expect(parsePersonKey("tmdb:525")).toEqual({ source: "tmdb", id: 525 });
    expect(parsePersonKey("openlibrary:12A")).toBeNull();
    expect(personHref({ source: "openlibrary", id: 12 })).toBe("/people/ol/12");
  });
});
