import Link from "next/link";
import { Suspense } from "react";
import { AppFrame } from "@/components/shell/app-frame";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LibrarySkeleton } from "@/components/library/library-skeleton";
import { SavedScreen } from "@/components/library/saved-screen";
import { libraryKey, libraryTitles } from "@/lib/library";
import { providersFor, savedTitles, watchingSeries } from "@/lib/picks/server";
import { requireOwner } from "@/lib/session";

export const metadata = { title: "Saved" };

export default function SavedPage() {
  return (
    <Suspense
      fallback={
        <AppFrame>
          <LibrarySkeleton eyebrow="Saved" />
        </AppFrame>
      }
    >
      <Saved />
    </Suspense>
  );
}

async function Saved() {
  const owner = await requireOwner();
  const [saved, watching, providers] = await Promise.all([
    savedTitles(owner.id),
    watchingSeries(owner.id),
    providersFor(owner.id),
  ]);
  if (saved.length === 0 && watching.length === 0) {
    return (
      <AppFrame>
        <EmptyState
          eyebrow="Saved"
          title="Nothing saved yet"
          body="Everything you swipe right on and don't pick lands here, so you can come back to it another night. Series you're watching show up here too."
          action={
            <Link href="/movies" className={buttonClasses("solid", "lg", "self-start")}>
              Pick something
            </Link>
          }
        />
      </AppFrame>
    );
  }

  const cards = await libraryTitles(
    [...saved, ...watching.map((w) => ({ media: "series" as const, id: w.id }))],
    providers,
  );
  const items = saved.flatMap((s) => cards.get(libraryKey(s.media, s.id)) ?? []);
  const watchingEntries = watching.flatMap((w) => {
    const show = cards.get(libraryKey("series", w.id));
    return show ? [{ since: w.since.toISOString(), show }] : [];
  });
  return (
    <SavedScreen
      items={items}
      watching={watchingEntries}
      total={saved.length}
      missing={saved.length - items.length}
    />
  );
}
