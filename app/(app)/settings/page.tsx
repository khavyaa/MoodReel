import Link from "next/link";
import { headers } from "next/headers";
import { Suspense } from "react";
import { getAuthenticatorName } from "@better-auth/passkey";
import { AppFrame } from "@/components/shell/app-frame";
import { LookPicker } from "@/components/settings/look-picker";
import { AddPasskeyButton, RemovePasskeyButton, SignOutButton } from "@/components/settings/account-actions";
import { auth } from "@/lib/auth";
import { requireOwner } from "@/lib/session";

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

        <Section
          title="Passkeys"
          note="Passkeys on iPhone and Mac sync through iCloud Keychain. Add one here for a device outside that, like a security key."
        >
          <Suspense fallback={<p className="text-muted">Loading your passkeys…</p>}>
            <PasskeyList />
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
