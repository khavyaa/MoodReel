import { Suspense } from "react";
import { AppFrame } from "@/components/shell/app-frame";
import { ListsBrowser } from "@/components/lists/lists-browser";
import { listCovers, suggestedCollections } from "@/lib/lists/covers";
import { requireOwner } from "@/lib/session";

export const metadata = { title: "Lists" };

/** Lists: award winners, top-rated lists and film collections, each with how far through it you are. */
export default function ListsPage() {
  return (
    <AppFrame>
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <span className="label text-muted">Lists</span>
          <h1 className="display text-[clamp(3rem,7vw,6rem)]">Worth getting through</h1>
          <p className="max-w-[60ch] text-muted">
            Follow a list and its titles rank a little higher in your decks, with a badge. Or deal straight from one.
          </p>
        </header>
        <Suspense fallback={<p className="text-muted">Counting what you&apos;ve seen…</p>}>
          <Browser />
        </Suspense>
      </div>
    </AppFrame>
  );
}

async function Browser() {
  const owner = await requireOwner();
  const { lists, started } = await listCovers(owner.id);
  // Not awaited: the well-known collections stream in when you open Collections.
  const suggested = suggestedCollections(owner.id, new Set(started.map((s) => s.slug))).catch(() => []);
  return <ListsBrowser lists={lists} started={started} suggested={suggested} />;
}
