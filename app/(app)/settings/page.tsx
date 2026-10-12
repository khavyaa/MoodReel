import Link from "next/link";
import { headers } from "next/headers";
import { Suspense } from "react";
import { getAuthenticatorName } from "@better-auth/passkey";
import { AppFrame } from "@/components/shell/app-frame";
import { LookPicker } from "@/components/settings/look-picker";
import { AddPasskeyButton, RemovePasskeyButton, SignOutButton } from "@/components/settings/account-actions";
import { auth } from "@/lib/auth";
import { requireOwner } from "@/lib/session";
import { providersFor } from "@/lib/picks/server";
import { regionProviders } from "@/lib/tmdb/providers";
import { nytStatus } from "@/lib/books/nyt";
import { ServicesPicker } from "@/components/settings/services-picker";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <AppFrame>
      <div className="flex flex-col gap-2 pb-8">
        <span className="label text-muted">Settings</span>
        <h1 className="display text-[clamp(3rem,7vw,6rem)]">Settings</h1>
      </div>

      <div className="grid gap-x-16 gap-y-12 lg:grid-cols-2">
        <Section title="Look" note="This device only. Your other devices keep their own setting.">
          <LookPicker />
        </Section>

        <Section title="Streaming services" note="What you subscribe to in India. Decks favour films on these.">
          <Suspense fallback={<p className="text-muted">Loading services…</p>}>
            <Services />
          </Suspense>
        </Section>

        <Section
          title="Passkeys"
          note="Passkeys on iPhone and Mac sync through iCloud Keychain. Add one here for a device outside that, like a security key."
        >
          <Suspense fallback={<p className="text-muted">Loading your passkeys…</p>}>
            <PasskeyList />
          </Suspense>
        </Section>

        <Section title="Book bestsellers" note="New York Times lists, synced daily at 8:00 IST.">
          <Suspense fallback={<p className="text-muted">Checking the last sync…</p>}>
            <Bestsellers />
          </Suspense>
        </Section>

        <Section title="Account">
          <div className="flex flex-wrap items-center gap-3">
            <SignOutButton />
            <Link href="/about" className="text-sm font-semibold underline underline-offset-4">
              About &amp; credits
            </Link>
          </div>
        </Section>
      </div>
    </AppFrame>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-t border-line pt-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-bold">{title}</h2>
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
      <AddPasskeyButton />
    </div>
  );
}
