"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { KeyRound } from "lucide-react";
import { claimOwner, type SetupState } from "@/app/(auth)/setup/actions";
import { authClient, passkeyErrorMessage } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

/*
 * Two steps on purpose. Safari only shows the passkey prompt when it starts
 * directly from a tap, so the prompt can't follow the token check automatically:
 * the second step is its own button.
 */
export function SetupForm() {
  const router = useRouter();
  const [state, formAction, checking] = useActionState<SetupState, FormData>(claimOwner, {});
  const [passkeyError, setPasskeyError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function savePasskey(grant: string) {
    setSaving(true);
    setPasskeyError(null);
    try {
      const result = await authClient.passkey.addPasskey({ context: grant, createSession: true });
      if (result?.error) {
        setPasskeyError(passkeyErrorMessage(result.error));
        return;
      }
      router.replace("/movies");
      router.refresh();
    } catch (err) {
      setPasskeyError(passkeyErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (state.grant) {
    const grant = state.grant;
    return (
      <div className="flex flex-col gap-4">
        <p className="font-medium">Token accepted. Now save a passkey on this device.</p>
        <Button size="lg" className="self-start" onClick={() => savePasskey(grant)} disabled={saving}>
          <KeyRound className="size-5" aria-hidden />
          {saving ? "Waiting for your passkey…" : "Save a passkey"}
        </Button>
        {passkeyError && (
          <p role="alert" className="rounded-2xl bg-soft px-4 py-3 text-sm font-medium">
            {passkeyError}
          </p>
        )}
        <p className="text-sm text-muted">This step expires in 10 minutes.</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-2" htmlFor="setup-token">
        <span className="label text-muted">Setup token</span>
        <input
          id="setup-token"
          name="token"
          type="password"
          autoComplete="off"
          required
          className="h-12 rounded-2xl border-2 border-line bg-transparent px-4 font-mono text-[15px] outline-none focus:border-accent"
        />
      </label>
      <Button type="submit" size="lg" className="self-start" disabled={checking}>
        {checking ? "Checking…" : "Continue"}
      </Button>
      {state.error && (
        <p role="alert" className="rounded-2xl bg-soft px-4 py-3 text-sm font-medium">
          {state.error}
        </p>
      )}
    </form>
  );
}
