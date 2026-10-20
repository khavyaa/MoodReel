"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { KeyRound } from "lucide-react";
import { authClient, passkeyErrorMessage } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/** Only same-site paths, so a crafted ?next= can't send you elsewhere. */
function nextPath() {
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/movies";
}

export function PasskeySignIn({ label = "Sign in with passkey", centred = false }: { label?: string; centred?: boolean } = {}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setPending(true);
    setError(null);
    try {
      const result = await authClient.signIn.passkey();
      if (result?.error) {
        setError(passkeyErrorMessage(result.error));
        return;
      }
      router.replace(nextPath());
      router.refresh();
    } catch (err) {
      setError(passkeyErrorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={cn("flex flex-col gap-3", centred && "items-center text-center")}>
      <Button size="lg" onClick={signIn} disabled={pending} className={centred ? undefined : "self-start"}>
        <KeyRound className="size-5" aria-hidden />
        {pending ? "Waiting for your passkey…" : label}
      </Button>
      {error && (
        <p role="alert" className="max-w-md rounded-2xl bg-soft px-4 py-3 text-sm font-medium">
          {error}
        </p>
      )}
    </div>
  );
}
