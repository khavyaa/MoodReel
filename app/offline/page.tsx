import Link from "next/link";
import { WifiOff } from "lucide-react";

export const metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center px-6 py-20 text-center">
      <WifiOff className="size-10 text-ink-600" aria-hidden />
      <h1 className="mt-5 text-xl font-semibold">You are offline</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-400">
        MoodReel keeps movie data online-only so recommendations are never stale. Reconnect and try
        again — your saved lists are still here.
      </p>
      <Link
        href="/app"
        className="mt-6 rounded-xl border border-ink-700 bg-ink-900 px-4 py-2.5 text-sm font-medium text-ink-100"
      >
        Try again
      </Link>
    </main>
  );
}
