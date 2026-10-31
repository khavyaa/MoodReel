import Link from "next/link";
import { Suspense } from "react";
import { AppFrame } from "@/components/shell/app-frame";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { HistoryList, SeenList, TurnedDownList, UnavailableList } from "@/components/library/library-lists";
import { LibrarySkeleton } from "@/components/library/library-skeleton";
import { picksPage, seenPage, turnedDownPage } from "@/lib/library-pages";
import { pickCount, seenCount, turnedDownCount } from "@/lib/picks/server";
import { requireOwner } from "@/lib/session";
import { cn } from "@/lib/cn";

export const metadata = { title: "History" };

type Tab = "picks" | "seen" | "down";

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
  const tab: Tab = params.tab === "seen" ? "seen" : params.tab === "down" ? "down" : "picks";
  const [picks, seen, down] = await Promise.all([pickCount(owner.id), seenCount(owner.id), turnedDownCount(owner.id)]);

  if (picks === 0 && seen === 0 && down === 0) {
    return (
      <EmptyState
        eyebrow="History"
        title="No picks yet"
        body="Each night's pick shows up here with the mood you were in, so you can see what worked and rate it after. Everything you mark seen or read is kept here too."
        action={
          <div className="flex flex-wrap gap-3">
            <Link href="/movies" className={buttonClasses("solid", "lg")}>
              Pick something
            </Link>
            <Link href="/add" className={buttonClasses("outline", "lg")}>
              Add what you&apos;ve already seen
            </Link>
          </div>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <span className="label text-muted">
          History · {count(picks, "pick", "picks")} · {seen.toLocaleString("en-IN")} seen or read{down > 0 ? ` · ${down} turned down` : ""}
        </span>
        <h1 className="display text-[clamp(3rem,7vw,6rem)]">
          {tab === "picks" ? "What you picked" : tab === "seen" ? "What you've seen" : "Turned down"}
        </h1>
      </header>
      <nav aria-label="History" className="flex flex-wrap gap-2">
        <TabLink tab="picks" current={tab} label={`Picks · ${picks}`} />
        <TabLink tab="seen" current={tab} label={`Seen & read · ${seen}`} />
        {(down > 0 || tab === "down") && <TabLink tab="down" current={tab} label={`Turned down · ${down}`} />}
        <Link
          href="/add"
          aria-label="Add what you've already seen or read"
          className="inline-flex h-11 items-center rounded-full border-2 border-line px-4 text-[15px] font-semibold transition-colors hover:bg-soft sm:px-5"
        >
          + Add
        </Link>
      </nav>
      {tab === "picks" ? (
        <Picks userId={owner.id} total={picks} />
      ) : tab === "seen" ? (
        <Seen userId={owner.id} total={seen} />
      ) : (
        <TurnedDown userId={owner.id} total={down} />
      )}
    </div>
  );
}

const count = (n: number, one: string, many: string) => `${n.toLocaleString("en-IN")} ${n === 1 ? one : many}`;

function TabLink({ tab, current, label }: { tab: Tab; current: Tab; label: string }) {
  const active = tab === current;
  return (
    <Link
      href={tab === "picks" ? "/history" : `/history?tab=${tab}`}
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

async function Picks({ userId, total }: { userId: string; total: number }) {
  const first = await picksPage(userId, 0);
  if (first.fetched === 0) return <p className="text-lg text-muted">No picks yet. Everything you&apos;ve seen or read is under Seen &amp; read.</p>;
  return (
    <>
      <HistoryList entries={first.entries} fetched={first.fetched} total={total} />
      <UnavailableList items={first.unavailable} />
    </>
  );
}

async function Seen({ userId, total }: { userId: string; total: number }) {
  const first = await seenPage(userId, 0);
  if (first.fetched === 0) return <p className="text-lg text-muted">Nothing marked seen or read yet.</p>;
  return (
    <>
      <SeenList entries={first.entries} fetched={first.fetched} total={total} />
      <UnavailableList items={first.unavailable} />
    </>
  );
}

async function TurnedDown({ userId, total }: { userId: string; total: number }) {
  const first = await turnedDownPage(userId, 0);
  return <TurnedDownList entries={first.entries} fetched={first.fetched} total={total} />;
}
