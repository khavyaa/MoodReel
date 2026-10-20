"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useOffline } from "next/offline";
import { RotateCcw } from "lucide-react";

/*
 * Swipes, undos and picks save in the background, strictly in order, so the
 * deck never waits and a fast swiper never races their own saves. A save that
 * fails is tried again a couple of times; if it still fails, the queue stops
 * there (later saves wait behind it, keeping the order) and says so, with a
 * Retry. Offline, saves simply wait: Next sends them when the connection returns.
 */

export type SaveStatus = "idle" | "saving" | "failed";

/** Tries a save again after these waits before calling it failed. */
const RETRY_AFTER_MS = [700, 2000];

async function withRetries<T>(job: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await job();
    } catch (error) {
      if (attempt >= RETRY_AFTER_MS.length) throw error;
      await new Promise((r) => setTimeout(r, RETRY_AFTER_MS[attempt]));
    }
  }
}

export function useSaveQueue() {
  const jobs = useRef<(() => Promise<unknown>)[]>([]);
  const running = useRef(false);
  const waiters = useRef<(() => void)[]>([]);
  const [status, setStatus] = useState<SaveStatus>("idle");

  const pump = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setStatus("saving");
    while (jobs.current.length) {
      try {
        await withRetries(jobs.current[0]);
        jobs.current.shift();
      } catch (error) {
        console.warn("[moodreel] save failed", error);
        running.current = false;
        setStatus("failed");
        return;
      }
    }
    running.current = false;
    setStatus("idle");
    waiters.current.splice(0).forEach((resolve) => resolve());
  }, []);

  const enqueue = useCallback(
    (job: () => Promise<unknown>) => {
      jobs.current.push(job);
      void pump();
    },
    [pump],
  );

  /** Resolves once every save so far has gone through. */
  const settled = useCallback(
    () =>
      jobs.current.length === 0 && !running.current
        ? Promise.resolve()
        : new Promise<void>((resolve) => waiters.current.push(resolve)),
    [],
  );

  return { enqueue, retry: pump, settled, status };
}

/** Only after this long does a save in progress say so: most finish unseen. */
const SHOW_SAVING_AFTER_MS = 1500;

/**
 * A slim bar under the header while a save is slow, and a clear one with Retry
 * when it failed. Offline, the app-wide banner already explains the wait.
 */
export function SaveStatusBar({ status, onRetry }: { status: SaveStatus; onRetry: () => void }) {
  const offline = useOffline();
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (status !== "saving") return;
    const timer = setTimeout(() => setSlow(true), SHOW_SAVING_AFTER_MS);
    return () => {
      clearTimeout(timer);
      setSlow(false);
    };
  }, [status]);

  if (status === "failed") {
    return (
      <div
        role="alert"
        className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-fg px-4 py-3 text-sm font-semibold text-bg"
      >
        <span className="flex-1">Your last change didn&apos;t save. Nothing&apos;s lost on this screen.</span>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-bg px-4 font-bold text-fg"
        >
          <RotateCcw className="size-4" aria-hidden /> Retry
        </button>
      </div>
    );
  }
  if (status === "saving" && slow && !offline) {
    return (
      <p role="status" className="label mb-4 text-muted">
        Saving…
      </p>
    );
  }
  return null;
}
