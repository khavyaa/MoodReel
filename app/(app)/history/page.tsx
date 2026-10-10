import Link from "next/link";
import { Suspense } from "react";
import { AppFrame } from "@/components/shell/app-frame";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { HistoryList, type HistoryEntry } from "@/components/library/library-lists";
import { LibrarySkeleton } from "@/components/library/library-skeleton";
import { libraryKey, libraryTitles } from "@/lib/library";
import { pickHistory, providersFor } from "@/lib/picks/server";
import { requireOwner } from "@/lib/session";

export const metadata = { title: "History" };

export default function HistoryPage() {
  return (
    <AppFrame>
      <Suspense fallback={<LibrarySkeleton eyebrow="History" />}>
        <History />
      </Suspense>
    </AppFrame>
  );
}

async function History() {
  const owner = await requireOwner();
  const picks = await pickHistory(owner.id);
  if (picks.length === 0) {
    return (
      <EmptyState
        eyebrow="History"
        title="No picks yet"
        body="Each night's pick shows up here with the mood you were in, so you can see what worked and rate it after."
        action={
          <Link href="/movies" className={buttonClasses("solid", "lg", "self-start")}>
            Pick something
          </Link>
        }
      />
    );
  }

  const cards = await libraryTitles(picks, await providersFor(owner.id));
  const entries: HistoryEntry[] = picks.flatMap((p) => {
    const movie = cards.get(libraryKey(p.media, p.id));
    if (!movie) return [];
    return [
      {
        sessionId: p.sessionId,
        mood: p.mood,
        why: p.why,
        pickedAt: p.pickedAt?.toISOString() ?? null,
        seen: p.seen,
        watching: p.watching,
        dropped: p.dropped,
        followUp: p.followUp,
        stars: p.rating === null ? null : Math.round(p.rating / 2),
        movie,
      },
    ];
  });

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <span className="label text-muted">
          History · {picks.length} {picks.length === 1 ? "pick" : "picks"}
        </span>
        <h1 className="display text-[clamp(3rem,7vw,6rem)]">What you picked</h1>
      </header>
      <HistoryList entries={entries} />
    </div>
  );
}
