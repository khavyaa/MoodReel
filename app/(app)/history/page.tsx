import Link from "next/link";
import { Suspense } from "react";
import { AppFrame } from "@/components/shell/app-frame";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  HistoryList,
  SeenList,
  UnavailableList,
  type HistoryEntry,
  type SeenEntry,
  type Unavailable,
} from "@/components/library/library-lists";
import { LibrarySkeleton } from "@/components/library/library-skeleton";
import { libraryKey, libraryTitles } from "@/lib/library";
import { Pager, pageFrom } from "@/components/library/pager";
import { withLinksByKey } from "@/lib/adaptations/server";
import { LIST_PAGE, pickCount, pickHistory, providersFor, seenCount, seenTitles } from "@/lib/picks/server";
import { requireOwner } from "@/lib/session";
import { cn } from "@/lib/cn";

export const metadata = { title: "History" };

type Tab = "picks" | "seen";

export default function HistoryPage({ searchParams }: PageProps<"/history">) {
  return (
    <AppFrame>
      <Suspense fallback={<LibrarySkeleton eyebrow="History" />}>
        <History searchParams={searchParams} />
      </Suspense>
    </AppFrame>
  );
}

async function History({ searchParams }: { searchParams: PageProps<"/history">["searchParams"] }) {
  const owner = await requireOwner();
  const params = await searchParams;
  const tab: Tab = params.tab === "seen" ? "seen" : "picks";
  const [picks, seen] = await Promise.all([pickCount(owner.id), seenCount(owner.id)]);
  const pages = Math.max(1, Math.ceil((tab === "picks" ? picks : seen) / LIST_PAGE));
  const page = pageFrom(params.page, pages);

  if (picks === 0 && seen === 0) {
    return (
      <EmptyState
        eyebrow="History"
        title="No picks yet"
        body="Each night's pick shows up here with the mood you were in, so you can see what worked and rate it after. Everything you mark seen or read is kept here too."
        action={
          <Link href="/movies" className={buttonClasses("solid", "lg", "self-start")}>
            Pick something
          </Link>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <span className="label text-muted">
          History · {count(picks, "pick", "picks")} · {seen.toLocaleString("en-IN")} seen or read
        </span>
        <h1 className="display text-[clamp(3rem,7vw,6rem)]">{tab === "picks" ? "What you picked" : "What you've seen"}</h1>
      </header>
      <nav aria-label="History" className="flex flex-wrap gap-2">
        <TabLink tab="picks" current={tab} label={`Picks · ${picks}`} />
        <TabLink tab="seen" current={tab} label={`Seen & read · ${seen}`} />
      </nav>
      {tab === "picks" ? (
        <Picks userId={owner.id} page={page} />
      ) : (
        <Seen userId={owner.id} page={page} />
      )}
      <Pager
        page={page}
        pages={pages}
        href={(n) => `/history?${new URLSearchParams({ ...(tab === "seen" ? { tab } : {}), ...(n > 1 ? { page: String(n) } : {}) })}`}
        label="History pages"
      />
    </div>
  );
}

const count = (n: number, one: string, many: string) => `${n.toLocaleString("en-IN")} ${n === 1 ? one : many}`;

function TabLink({ tab, current, label }: { tab: Tab; current: Tab; label: string }) {
  const active = tab === current;
  return (
    <Link
      href={tab === "picks" ? "/history" : "/history?tab=seen"}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-11 items-center rounded-full border-2 px-4 text-[15px] font-semibold transition-colors sm:px-5",
        active ? "border-accent bg-accent text-on-accent" : "border-line hover:bg-soft",
      )}
    >
      {label}
    </Link>
  );
}

async function Picks({ userId, page }: { userId: string; page: number }) {
  const picks = await pickHistory(userId, LIST_PAGE, (page - 1) * LIST_PAGE);
  if (picks.length === 0) return <p className="text-lg text-muted">No picks yet. Everything you&apos;ve seen or read is under Seen &amp; read.</p>;
  const cards = await withLinksByKey(userId, await libraryTitles(picks, await providersFor(userId)));
  const entries: HistoryEntry[] = [];
  const unavailable: Unavailable[] = [];
  for (const p of picks) {
    const movie = cards.get(libraryKey(p.media, p.id));
    if (!movie) {
      unavailable.push({ media: p.media, id: p.id, list: "picked", at: p.pickedAt?.toISOString() });
      continue;
    }
    entries.push({
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
    });
  }
  return (
    <>
      <HistoryList entries={entries} />
      <UnavailableList items={unavailable} />
    </>
  );
}

async function Seen({ userId, page }: { userId: string; page: number }) {
  const seen = await seenTitles(userId, LIST_PAGE, (page - 1) * LIST_PAGE);
  if (seen.length === 0) return <p className="text-lg text-muted">Nothing marked seen or read yet.</p>;
  const cards = await libraryTitles(seen, await providersFor(userId));
  const entries: SeenEntry[] = [];
  const unavailable: Unavailable[] = [];
  for (const s of seen) {
    const movie = cards.get(libraryKey(s.media, s.id));
    if (movie) entries.push({ at: s.at.toISOString(), stars: s.rating === null ? null : Math.round(s.rating / 2), movie });
    else unavailable.push({ media: s.media, id: s.id, list: "seen", at: s.at.toISOString() });
  }
  return (
    <>
      <SeenList entries={entries} />
      <UnavailableList items={unavailable} />
    </>
  );
}
