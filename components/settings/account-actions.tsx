"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { KeyRound, LogOut, Trash2 } from "lucide-react";
import { authClient, passkeyErrorMessage } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { forgetOfflinePages } from "@/components/shell/service-worker";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await authClient.signOut();
        await forgetOfflinePages();
        router.replace("/sign-in");
        router.refresh();
      }}
    >
      <LogOut className="size-4" aria-hidden />
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}

export function AddPasskeyButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="outline"
        className="self-start"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(null);
          try {
            const result = await authClient.passkey.addPasskey();
            if (result?.error) setError(passkeyErrorMessage(result.error));
            else router.refresh();
          } catch (err) {
            setError(passkeyErrorMessage(err));
          } finally {
            setPending(false);
          }
        }}
      >
        <KeyRound className="size-4" aria-hidden />
        {pending ? "Waiting for your passkey…" : "Add a passkey"}
      </Button>
      {error && (
        <p role="alert" className="text-sm font-medium">
          {error}
        </p>
      )}
    </div>
  );
}

export function RemovePasskeyButton({ id, disabled }: { id: string; disabled: boolean }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  if (disabled) return null;

  if (!confirming) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setConfirming(true)} aria-label="Remove passkey">
        <Trash2 className="size-4" aria-hidden />
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="danger"
        size="sm"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          await authClient.passkey.deletePasskey({ id });
          router.refresh();
        }}
      >
        {pending ? "Removing…" : "Remove"}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
        Keep
      </Button>
    </div>
  );
}
