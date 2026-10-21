"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

/** A sheet over the page: from the bottom on a phone, centred on a laptop. Escape or a tap outside closes it. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 text-left sm:items-center"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88dvh] w-full max-w-xl flex-col gap-5 overflow-y-auto rounded-t-3xl bg-raised p-6 text-fg shadow-xl sm:rounded-3xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-xl font-black">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="-m-2 p-2">
            <X className="size-5" aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
