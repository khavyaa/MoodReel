"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut, Trash2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
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
