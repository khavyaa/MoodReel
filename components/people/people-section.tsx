import Link from "next/link";
import { Suspense } from "react";
import { peoplePrefsFor } from "@/lib/people/server";
import { peopleSuggestions } from "@/lib/people/suggest";
import { personHref, personKey, type Person } from "@/lib/people/types";
import { requireOwner } from "@/lib/session";
import { PersonPrefButton } from "./people-buttons";

const ROLE: Record<Person["role"], string> = {
  director: "Director",
  creator: "Creator",
  writer: "Writer",
  actor: "Actor",
  author: "Author",
};

const dealHref = (p: Person) =>
  `/${p.role === "author" ? "books" : "movies"}?with=${personKey(p)}&name=${encodeURIComponent(p.name)}`;

/** People in Saved: who you follow (deal from them), suggestions, and who you avoid. */
export async function PeopleSection() {
  const owner = await requireOwner();
  const prefs = await peoplePrefsFor(owner.id);
  const following = prefs.filter((p) => p.kind === "follow").map((p) => p.person);
  const avoided = prefs.filter((p) => p.kind === "avoid").map((p) => p.person);
  const known = new Set(prefs.map((p) => personKey(p.person)));

  return (
    <section id="people" aria-labelledby="people-heading" className="flex flex-col gap-5">
      <h2 id="people-heading" className="text-2xl font-black">
        People
      </h2>

      {following.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-3xl bg-soft p-5 sm:p-7">
          <h3 className="font-black">Following · {following.length}</h3>
          <ul className="grid gap-3 md:grid-cols-2">
            {following.map((p) => (
              <li key={personKey(p)} className="flex items-center justify-between gap-3">
                <Link href={personHref(p)} className="min-w-0">
                  <span className="block truncate font-bold">{p.name}</span>
                  <span className="text-sm text-muted">{ROLE[p.role]}</span>
                </Link>
                <Link
                  href={dealHref(p)}
                  className="h-9 shrink-0 rounded-full bg-fg px-4 text-sm leading-9 font-bold text-bg hover:opacity-90"
                >
                  Deal →
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-muted">
          Tap a director, actor, writer or author on any card to follow them: their work ranks higher everywhere.
        </p>
      )}

      <Suspense fallback={null}>
        <Suggestions userId={owner.id} known={known} />
      </Suspense>

      {avoided.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="font-black">Avoided · {avoided.length}</h3>
          <ul className="flex flex-col gap-2">
            {avoided.map((p) => (
              <li key={personKey(p)} className="flex flex-wrap items-center gap-3 text-sm">
                <Link href={personHref(p)} className="font-bold">
                  {p.name}
                </Link>
                <span className="text-muted">their work never comes up</span>
                <PersonPrefButton person={p} kind={null} label="Undo" />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

async function Suggestions({ userId, known }: { userId: string; known: Set<string> }) {
  const suggestions = await peopleSuggestions(userId, known).catch(() => []);
  if (!suggestions.length) return null;
  return (
    <div className="flex flex-col gap-3 rounded-3xl border-2 border-dashed border-line p-5 sm:p-7">
      <h3 className="font-black">Suggested</h3>
      <ul className="flex flex-col gap-4">
        {suggestions.map(({ person, count }) => (
          <li key={personKey(person)} className="flex flex-col gap-2">
            <p>
              You&apos;ve loved {count} {person.role === "author" ? "books" : "titles"} with{" "}
              <Link href={personHref(person)} className="font-bold underline underline-offset-4">
                {person.name}
              </Link>
              . Follow?
            </p>
            <div className="flex gap-2">
              <PersonPrefButton person={person} kind="follow" label="Follow" primary />
              <PersonPrefButton person={person} kind="dismissed" label="Not now" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
