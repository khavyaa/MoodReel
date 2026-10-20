import { Suspense } from "react";
import { AppFrame } from "@/components/shell/app-frame";
import { PeopleSearch } from "@/components/people/people-search";
import { PeopleSection } from "@/components/people/people-section";
import { peoplePrefsFor, photosFor } from "@/lib/people/server";
import { personKey } from "@/lib/people/types";
import { requireOwner } from "@/lib/session";

export const metadata = { title: "People" };

/** People: find anyone, and the directors, actors, writers and authors you follow, are suggested or avoid. */
export default function PeoplePage() {
  return (
    <AppFrame>
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-2">
          <span className="label text-muted">People</span>
          <h1 className="display text-[clamp(3rem,7vw,6rem)]">Who you watch for</h1>
        </header>
        <Suspense fallback={<PeopleSearch />}>
          <SearchWithYourPeople />
        </Suspense>
        <Suspense fallback={<p className="text-muted">Loading your people…</p>}>
          <PeopleSection />
        </Suspense>
      </div>
    </AppFrame>
  );
}

const ROLE_WORD = { director: "director", creator: "creator", writer: "writer", actor: "actor", author: "author" } as const;

/** The search box, knowing who you follow and avoid, so they come up as you type. */
async function SearchWithYourPeople() {
  const owner = await requireOwner();
  const prefs = (await peoplePrefsFor(owner.id)).filter((p) => p.kind === "follow" || p.kind === "avoid");
  const photos = await photosFor(prefs.map((p) => p.person)).catch(() => new Map());
  return (
    <PeopleSearch
      known={prefs.map((p) => ({
        key: personKey(p.person),
        name: p.person.name,
        detail: `${ROLE_WORD[p.person.role]} · ${p.kind === "follow" ? "following" : "avoided"}`,
        photo: photos.get(personKey(p.person)) ?? null,
      }))}
    />
  );
}
