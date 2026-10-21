import Link from "next/link";
import { Suspense } from "react";
import { peoplePrefsFor, photosFor } from "@/lib/people/server";
import { peopleSuggestions } from "@/lib/people/suggest";
import { personHref, personKey, type Person } from "@/lib/people/types";
import { requireOwner } from "@/lib/session";
import { PersonPrefButton } from "./people-buttons";
import { Avatar } from "./avatar";
import { CoverFlow } from "@/components/flow/cover-flow";
import { buttonClasses } from "@/components/ui/button";

const ROLE: Record<Person["role"], string> = {
  director: "Director",
  creator: "Creator",
  writer: "Writer",
  actor: "Actor",
  author: "Author",
};

const dealHref = (p: Person) =>
  `/${p.role === "author" ? "books" : "movies"}?with=${personKey(p)}&name=${encodeURIComponent(p.name)}`;

/** The People page's lists: who you follow (deal from them), suggestions, and who you avoid, with photos. */
export async function PeopleSection() {
  const owner = await requireOwner();
  const prefs = await peoplePrefsFor(owner.id);
  const following = prefs.filter((p) => p.kind === "follow").map((p) => p.person);
  const avoided = prefs.filter((p) => p.kind === "avoid").map((p) => p.person);
  const known = new Set(prefs.map((p) => personKey(p.person)));
  const photos = await photosFor([...following, ...avoided]).catch(() => new Map());

  return (
    <section id="people" aria-label="Your people" className="flex flex-col gap-5">
      {following.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h3 className="label text-muted">Following · {following.length}</h3>
          <CoverFlow
            label="People you follow"
            items={following.map((p) => ({ key: personKey(p), title: p.name, image: photos.get(personKey(p)) ?? null, round: true }))}
            infos={following.map((p) => (
              <div key={personKey(p)} className="flex flex-col items-center gap-3 text-center">
                <div>
                  <Link href={personHref(p)} className="text-2xl leading-tight font-black underline-offset-4 hover:underline">
                    {p.name}
                  </Link>
                  <p className="text-sm text-muted">{ROLE[p.role]}</p>
                </div>
                <div className="flex gap-2">
                  <Link href={personHref(p)} className={buttonClasses("outline", "md")}>
                    Their work
                  </Link>
                  <Link href={dealHref(p)} className={buttonClasses("solid", "md")}>
                    Deal from them →
                  </Link>
                </div>
              </div>
            ))}
          />
        </div>
      ) : (
        <p className="text-muted">Search above, or tap a name on any card, to follow someone: their work ranks higher everywhere.</p>
      )}

      <div className="flex flex-col gap-3">
        <Suspense fallback={null}>
          <Suggestions userId={owner.id} known={known} />
        </Suspense>

        {avoided.length > 0 && (
          <details className="group">
            <summary className={summary}>Avoided · {avoided.length}</summary>
            <ul className="mt-3 flex flex-col gap-2">
              {avoided.map((p) => (
                <li key={personKey(p)} className="flex flex-wrap items-center gap-3 text-sm">
                  <Avatar name={p.name} photo={photos.get(personKey(p)) ?? null} className="size-9" />
                  <Link href={personHref(p)} className="font-bold">
                    {p.name}
                  </Link>
                  <span className="text-muted">their work never comes up</span>
                  <PersonPrefButton person={p} kind={null} label="Undo" />
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </section>
  );
}

/** A small chip that opens a short list in place (Suggested, Avoided). */
const summary =
  "inline-flex h-10 cursor-pointer list-none items-center rounded-full border-2 border-line px-4 text-sm font-semibold hover:bg-soft group-open:border-fg [&::-webkit-details-marker]:hidden";

async function Suggestions({ userId, known }: { userId: string; known: Set<string> }) {
  const suggestions = await peopleSuggestions(userId, known).catch(() => []);
  if (!suggestions.length) return null;
  const photos = await photosFor(suggestions.map((s) => s.person)).catch(() => new Map());
  return (
    <details className="group">
      <summary className={summary}>Suggested · {suggestions.length}</summary>
      <ul className="mt-3 flex flex-col gap-4">
        {suggestions.map(({ person, count }) => (
          <li key={personKey(person)} className="flex items-start gap-3">
            <Avatar name={person.name} photo={photos.get(personKey(person)) ?? null} />
            <div className="flex flex-col gap-2">
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
            </div>
          </li>
        ))}
      </ul>
    </details>
  );
}
