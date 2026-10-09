"use client";

import { useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";

type Look = "system" | "playful" | "cinematic";

const KEY = "mr-look";
const OPTIONS: { value: Look; label: string; hint: string }[] = [
  { value: "system", label: "Match this device", hint: "Playful in light mode, cinematic in dark mode" },
  { value: "playful", label: "Bold & playful", hint: "Always" },
  { value: "cinematic", label: "Cinematic dark", hint: "Always" },
];

/*
 * The override lives in localStorage and is applied to <html data-look> before
 * first paint by the script in app/layout.tsx. Read through useSyncExternalStore
 * so server and client agree on first render.
 */
const listeners = new Set<() => void>();

function read(): Look {
  try {
    const value = localStorage.getItem(KEY);
    return value === "playful" || value === "cinematic" ? value : "system";
  } catch {
    return "system";
  }
}

function write(look: Look) {
  try {
    if (look === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, look);
  } catch {
    // Storage blocked (private mode): the choice applies until the page reloads.
  }
  if (look === "system") delete document.documentElement.dataset.look;
  else document.documentElement.dataset.look = look;
  listeners.forEach((notify) => notify());
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

export function LookPicker() {
  const look = useSyncExternalStore(subscribe, read, () => "system" as Look);

  return (
    <div role="radiogroup" aria-label="Look" className="grid gap-2 sm:grid-cols-3">
      {OPTIONS.map((option) => {
        const active = look === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => write(option.value)}
            className={cn(
              "flex flex-col items-start gap-1 rounded-2xl border-2 px-4 py-3 text-left transition-colors",
              active ? "border-accent bg-soft" : "border-line hover:bg-soft",
            )}
          >
            <span className="font-semibold">{option.label}</span>
            <span className="text-sm text-muted">{option.hint}</span>
          </button>
        );
      })}
    </div>
  );
}
