import { Suspense } from "react";
import { AppFrame } from "@/components/shell/app-frame";
import { PeopleSearch } from "@/components/people/people-search";
import { PeopleSection } from "@/components/people/people-section";

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
        <PeopleSearch />
        <Suspense fallback={<p className="text-muted">Loading your people…</p>}>
          <PeopleSection />
        </Suspense>
      </div>
    </AppFrame>
  );
}
