"use client";

import { useOffline } from "next/offline";
import { WifiOff } from "lucide-react";

/** Shown under the header while offline. Anything you do meanwhile waits and is sent when you're back. */
export function OfflineBanner() {
  const offline = useOffline();
  if (!offline) return null;
  return (
    <div role="status" className="bg-soft">
      <p className="mx-auto flex w-full max-w-[1440px] items-center gap-2 px-5 py-1.5 text-[13px] font-semibold sm:px-8 sm:text-sm lg:px-12">
        <WifiOff className="size-3.5 shrink-0" aria-hidden />
        <span>
          You&apos;re offline<span className="hidden sm:inline">. Anything you do now is kept and sent when you&apos;re back</span>
          <span className="sm:hidden"> · changes sync when you&apos;re back</span>
        </span>
      </p>
    </div>
  );
}
