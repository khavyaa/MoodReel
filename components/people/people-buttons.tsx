"use client";

import { useTransition } from "react";
import { setPerson } from "@/app/(app)/people-actions";
import type { Person } from "@/lib/people/types";
import { cn } from "@/lib/cn";

/** A small button that sets (or clears) how you feel about a person. */
export function PersonPrefButton({
  person,
  kind,
  label,
  primary,
}: {
  person: Person;
  kind: "follow" | "avoid" | "dismissed" | null;
  label: string;
  primary?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => setPerson(person, kind))}
      className={cn(
        "h-9 rounded-full border-2 px-4 text-sm font-bold disabled:opacity-60",
        primary ? "border-accent bg-accent text-on-accent" : "border-line hover:bg-soft",
      )}
    >
      {label}
    </button>
  );
}
