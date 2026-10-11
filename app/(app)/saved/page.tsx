import Link from "next/link";
import { Suspense } from "react";
import { AppFrame } from "@/components/shell/app-frame";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LibrarySkeleton } from "@/components/library/library-skeleton";
import { SavedScreen } from "@/components/library/saved-screen";
import { libraryKey, libraryTitles } from "@/lib/library";
import { inProgress, providersFor, savedTitles } from "@/lib/picks/server";
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
  const [saved, watching, reading, providers] = await Promise.all([
    savedTitles(owner.id),
    inProgress(owner.id, "series"),
    inProgress(owner.id, "book"),
    providersFor(owner.id),
  ]);
  if (saved.length === 0 && watching.length === 0 && reading.length === 0) {
    return (
      <AppFrame>
        <EmptyState
          eyebrow="Saved"
          title="Nothing saved yet"
          body="Everything you swipe right on and don't pick lands here, so you can come back to it another night. Series you're watching and books you're reading show up here too."
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
    [
      ...saved,
      ...watching.map((w) => ({ media: "series" as const, id: w.id })),
      ...reading.map((r) => ({ media: "book" as const, id: r.id })),
    ],
    providers,
  );
  const items = saved.flatMap((s) => cards.get(libraryKey(s.media, s.id)) ?? []);
  const entries = (media: "series" | "book", list: { id: number; since: Date }[]) =>
    list.flatMap((w) => {
      const show = cards.get(libraryKey(media, w.id));
      return show ? [{ since: w.since.toISOString(), show }] : [];
    });
  return (
    <SavedScreen
      items={items}
      watching={entries("series", watching)}
      reading={entries("book", reading)}
      total={saved.length}
      missing={saved.length - items.length}
    />
  );
}
