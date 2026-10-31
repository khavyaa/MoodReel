"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

type Toast = {
  /** What just happened ("Removed Sicario from Saved"). */
  message: string;
  /** Puts it back as it was. */
  undo?: () => Promise<unknown> | void;
  /** Said once Undo has worked ("Sicario is back in Saved"). */
  undone?: string;
};

const ToastContext = createContext<(toast: Toast) => void>(() => {});

/** Show a toast: a small bar for five seconds, with Undo when there's something to take back. A new one replaces it. */
export const useToast = () => useContext(ToastContext);

/** How long a toast stays, unless you hover or focus it. */
const SHOW_FOR = 5000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<(Toast & { key: number; state: "shown" | "undoing" | "undone" | "failed" }) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduced = useReducedMotion();

  const hideLater = useCallback((after: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), after);
  }, []);
  const show = useCallback(
    (t: Toast) => {
      setToast({ ...t, key: Date.now(), state: "shown" });
      hideLater(SHOW_FOR);
    },
    [hideLater],
  );
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  async function undo() {
    if (!toast?.undo) return;
    const current = toast;
    setToast({ ...current, state: "undoing" });
    try {
      await current.undo!();
      setToast({ ...current, state: "undone" });
    } catch {
      setToast({ ...current, state: "failed" });
    }
    hideLater(2000);
  }

  return (
    <ToastContext value={show}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-4 lg:bottom-8">
        <AnimatePresence>
          {toast && (
            <motion.div
              key={toast.key}
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduced ? 0 : 8 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              onPointerEnter={() => timer.current && clearTimeout(timer.current)}
              onPointerLeave={() => hideLater(2000)}
              role="status"
              className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl bg-fg px-4 py-2 text-sm font-semibold text-bg shadow-[0_12px_32px_-12px_rgba(0,0,0,0.6)]"
            >
              <span className="min-w-0 flex-1 py-1.5">
                {toast.state === "undone"
                  ? (toast.undone ?? "Undone.")
                  : toast.state === "failed"
                    ? "Couldn't undo that just now."
                    : toast.message}
              </span>
              {toast.undo && toast.state !== "undone" && toast.state !== "failed" && (
                <button
                  type="button"
                  onClick={() => void undo()}
                  disabled={toast.state === "undoing"}
                  className="-my-1 min-h-11 shrink-0 rounded-full px-3 font-black underline underline-offset-4 disabled:opacity-60"
                >
                  Undo
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ToastContext>
  );
}
