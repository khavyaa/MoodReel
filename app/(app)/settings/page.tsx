import Link from "next/link";
import { headers } from "next/headers";
import { Suspense } from "react";
import { getAuthenticatorName } from "@better-auth/passkey";
import { AppFrame } from "@/components/shell/app-frame";
import { LookPicker } from "@/components/settings/look-picker";
import { ChevronRight } from "lucide-react";
import { RemovePasskeyButton, SignOutButton } from "@/components/settings/account-actions";
import { auth } from "@/lib/auth";
import { requireOwner } from "@/lib/session";
import { providersFor } from "@/lib/picks/server";
import { regionProviders } from "@/lib/tmdb/providers";
import { nytStatus } from "@/lib/books/nyt";
import { adaptationsStatus } from "@/lib/adaptations/sync";
import { lastListsSync } from "@/lib/lists/sync";
import { ServicesPicker } from "@/components/settings/services-picker";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <AppFrame>
      <div className="flex flex-col gap-2 pb-8">
        <span className="label text-muted">Settings</span>
        <h1 className="display text-[clamp(3rem,7vw,6rem)]">Settings</h1>
      </div>

      <div className="flex flex-col gap-6">
        <Group title="Picking">
          <Section title="Look" note="This device only. Your other devices keep their own setting.">
            <LookPicker />
          </Section>

          <Section title="Streaming services" note="What you subscribe to in India. Decks favour films on these.">
            <Suspense fallback={<p className="text-muted">Loading services…</p>}>
              <Services />
            </Suspense>
          </Section>
        </Group>

        <Group title="Background syncs" note="Run every day at 8:00 IST. Decks only read what they store, so a failed run never blocks a deal.">
          <Section title="Book bestsellers" note="New York Times lists, every day.">
            <Suspense fallback={<p className="text-muted">Checking the last sync…</p>}>
              <Bestsellers />
            </Suspense>
          </Section>

          <Section title="Books on screen" note="Which films and series are based on which books, from Wikidata, every week; links are checked on the other days.">
            <Suspense fallback={<p className="text-muted">Checking the last sync…</p>}>
              <Adaptations />
            </Suspense>
          </Section>

          <Section title="Award lists" note="Oscar, Palme d'Or, Booker and the other winners' lists, from Wikidata, every week.">
            <Suspense fallback={<p className="text-muted">Checking the last sync…</p>}>
              <AwardLists />
            </Suspense>
          </Section>
        </Group>

        <Group title="Account">
          <Section
            title="Passkeys"
            note="Your iPhone and Mac share one passkey through iCloud Keychain. A device outside that gets one from the setup page, with your setup token."
          >
            <Suspense fallback={<p className="text-muted">Loading your passkeys…</p>}>
              <PasskeyList />
            </Suspense>
          </Section>

          <Section title="Sign out">
            <div>
              <SignOutButton />
            </div>
          </Section>
        </Group>

        <Link href="/about" className="flex items-center justify-between gap-4 rounded-3xl border-2 border-line p-5 text-xl font-black hover:bg-soft sm:p-7">
          About &amp; credits <ChevronRight className="size-5" aria-hidden />
        </Link>
      </div>
    </AppFrame>
  );
}

/** A group in its own box: its sections side by side on a laptop, stacked on a phone. */
function Group({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-6 rounded-3xl border-2 border-line p-5 sm:p-7">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-black">{title}</h2>
        {note && <p className="max-w-[72ch] text-sm text-muted">{note}</p>}
      </div>
      <div className="grid gap-x-16 gap-y-8 lg:grid-cols-2">{children}</div>
    </section>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-bold">{title}</h3>
        {note && <p className="max-w-[56ch] text-sm text-muted">{note}</p>}
      </div>
      {children}
    </section>
  );
}

const SYNC_TIME = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});
const LIST_DATE = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** How the NYT sync is doing: Vercel keeps its logs for only an hour, so the app keeps a short report. */
async function Bestsellers() {
  await requireOwner();
  const status = await nytStatus().catch(() => null);
  if (!status) return <p className="text-muted">Couldn&apos;t read the sync status just now.</p>;
  if (!status.configured) {
    return <p className="text-muted">Off: no NYT key is set. Books still work on Open Library alone.</p>;
  }
  const run = status.lastRun;
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-2 text-sm">
      <dt className="text-muted">Last sync</dt>
      <dd>
        {run ? (
          <>
            {SYNC_TIME.format(run.at)} · {run.report.skipped ? `skipped: ${run.report.skipped}` : `${run.report.weeks.length} ${run.report.weeks.length === 1 ? "week" : "weeks"} fetched, ${run.report.matched} matched`}
          </>
        ) : (
          "Not recorded yet (runs are recorded from this update on)"
        )}
      </dd>
      <dt className="text-muted">Lists</dt>
      <dd>
        {status.weeksSynced} {status.weeksSynced === 1 ? "week" : "weeks"} synced
        {status.latestList ? `, latest ${LIST_DATE.format(new Date(status.latestList))}` : ""}
      </dd>
      <dt className="text-muted">Books</dt>
      <dd>
        {status.books.toLocaleString("en-IN")} {status.books === 1 ? "bestseller" : "bestsellers"},{" "}
        {status.matched.toLocaleString("en-IN")} matched to Open Library
      </dd>
      {run && run.report.errors.length > 0 && (
        <>
          <dt className="font-semibold">Problems</dt>
          <dd className="font-semibold">{run.report.errors.join("; ")}</dd>
        </>
      )}
    </dl>
  );
}

const count = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-IN")} ${n === 1 ? one : many}`;

/** How the weekly Wikidata sync of book ↔ film links is doing. */
async function Adaptations() {
  await requireOwner();
  const status = await adaptationsStatus().catch(() => null);
  if (!status) return <p className="text-muted">Couldn&apos;t read the sync status just now.</p>;
  const run = status.lastRun;
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-2 text-sm">
      <dt className="text-muted">Last sync</dt>
      <dd>
        {run
          ? `${SYNC_TIME.format(run.at)} · ${
              run.report.wikidata
                ? `${run.report.added.toLocaleString("en-IN")} new ${run.report.added === 1 ? "link" : "links"} from Wikidata`
                : `${run.report.checked.toLocaleString("en-IN")} books checked`
            }`
          : "Not yet: the first runs with the next daily sync at 8:00 IST"}
      </dd>
      <dt className="text-muted">Links</dt>
      <dd>
        {count(status.films, "film")} and {count(status.series, "series", "series")}, from {count(status.books, "book")}
      </dd>
      {run && run.report.errors.length > 0 && (
        <>
          <dt className="font-semibold">Problems</dt>
          <dd className="font-semibold">{run.report.errors.join("; ")}</dd>
        </>
      )}
    </dl>
  );
}

async function AwardLists() {
  await requireOwner();
  const run = await lastListsSync().catch(() => undefined);
  if (run === undefined) return <p className="text-muted">Couldn&apos;t read the sync status just now.</p>;
  const titles = run ? Object.values(run.report.lists).reduce((sum, n) => sum + n, 0) : 0;
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-2 text-sm">
      <dt className="text-muted">Last sync</dt>
      <dd>
        {run
          ? `${SYNC_TIME.format(run.at)} · ${count(Object.keys(run.report.lists).length, "list")}, ${count(titles, "title")}`
          : "Not yet: lists fill in when you first open them, and the weekly sync keeps them current"}
      </dd>
      {run && run.report.errors.length > 0 && (
        <>
          <dt className="font-semibold">Problems</dt>
          <dd className="font-semibold">{run.report.errors.join("; ")}</dd>
        </>
      )}
    </dl>
  );
}

async function Services() {
  const owner = await requireOwner();
  const [providers, selected] = await Promise.all([regionProviders().catch(() => null), providersFor(owner.id)]);
  if (!providers) return <p className="text-muted">Couldn&apos;t load the list from the movie database just now.</p>;
  return <ServicesPicker providers={providers} selected={selected} />;
}

const dateFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

async function PasskeyList() {
  await requireOwner();
  const passkeys = await auth.api.listPasskeys({ headers: await headers() });

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col divide-y divide-line rounded-2xl border-2 border-line">
        {passkeys.map((pk) => (
          <li key={pk.id} className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate font-semibold">
                {pk.name || getAuthenticatorName(pk.aaguid) || "Passkey"}
              </p>
              <p className="text-sm text-muted">
                Added {pk.createdAt ? dateFormat.format(new Date(pk.createdAt)) : "earlier"}
                {pk.backedUp ? " · synced" : " · this device only"}
              </p>
            </div>
            <RemovePasskeyButton id={pk.id} disabled={passkeys.length <= 1} />
          </li>
        ))}
      </ul>
      {passkeys.length <= 1 && (
        <p className="text-sm text-muted">
          Your only passkey can&apos;t be removed. If you ever lose it, /setup with your setup token adds a new one.
        </p>
      )}
    </div>
  );
}
