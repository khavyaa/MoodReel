"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * A modal over the page, on the browser's own <dialog>: focus moves into it
 * and stays there, the page behind can't be reached, Escape or a tap outside
 * closes it, and focus goes back to what opened it. From the bottom on a
 * phone, centred on a laptop.
 */
export function Modal({
  label,
  onClose,
  className,
  children,
}: {
  label: string;
  onClose: () => void;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    const onCancel = (e: Event) => {
      e.preventDefault();
      close.current();
    };
    dialog.addEventListener("cancel", onCancel);
    return () => {
      dialog.removeEventListener("cancel", onCancel);
      if (dialog.open) dialog.close();
      opener?.focus({ preventScroll: true });
    };
  }, []);

  return (
    <dialog
      ref={ref}
      aria-label={label}
      // The dialog fills the screen; a click on it (not on the panel) is a click outside.
      onClick={(e) => e.target === ref.current && close.current()}
      className="fixed inset-0 m-0 flex h-full max-h-none w-full max-w-none items-end justify-center bg-transparent p-0 text-left backdrop:bg-black/40 sm:items-center"
    >
      <div
        className={cn(
          "flex max-h-[88dvh] w-full flex-col gap-5 overflow-y-auto rounded-t-3xl bg-raised p-6 text-fg shadow-xl sm:rounded-3xl sm:p-8",
          className,
        )}
      >
        {children}
      </div>
    </dialog>
  );
}
