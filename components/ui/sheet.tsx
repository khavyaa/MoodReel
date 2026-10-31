"use client";

import type { ReactNode } from "react";
import { Modal } from "./modal";
import { X } from "lucide-react";

/** A sheet over the page with a title and Close: a Modal (focus kept inside, Escape or a tap outside closes it). */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <Modal label={title} onClose={onClose} className="max-w-xl">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-xl font-black">{title}</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="-m-2 grid size-11 place-items-center">
          <X className="size-5" aria-hidden />
        </button>
      </div>
      {children}
    </Modal>
  );
}
