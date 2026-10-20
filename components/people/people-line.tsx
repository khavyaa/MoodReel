"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { setPerson } from "@/app/(app)/people-actions";
import { personHref, type Person } from "@/lib/people/types";
import { cn } from "@/lib/cn";

const ROLE_LABEL: Record<Person["role"], string> = {
  director: "Directed by",
  creator: "Created by",
  writer: "Written by",
  actor: "With",
  author: "by",
};

/**
 * Who made a title, each name tappable. A tap opens a small sheet (follow,
 * avoid, see their work) rather than leaving the deck you're in.
 */
export function PeopleLine({
  people,
  followedName,
  compact = false,
  className,
}: {
  people: Person[];
  followedName?: string | null;
  /** iPhone: one line, makers and the first two actors. */
  compact?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState<Person | null>(null);
  if (!people.length) return null;

  const groups = (["director", "creator", "writer", "actor", "author"] as const)
    .map((role) => ({ role, people: people.filter((p) => p.role === role).slice(0, role === "actor" ? (compact ? 2 : 3) : 2) }))
    .filter((g) => g.people.length && !(compact && g.role === "writer"));

  const name = (p: Person) => (
    <button
      key={`${p.source}:${p.id}`}
      type="button"
      onClick={() => setOpen(p)}
      className="font-bold underline decoration-current/30 underline-offset-4 hover:decoration-current"
    >
      {p.name}
    </button>
  );

  return (
    <>
      <div className={cn(compact ? "flex flex-wrap gap-x-3 gap-y-1 text-sm" : "flex flex-col gap-1 text-sm lg:text-base", className)}>
        {groups.map((g) => (
          <p key={g.role} className="m-0">
            {compact && g.role === "director" ? "Dir." : ROLE_LABEL[g.role]}{" "}
            {g.people.map((p, i) => (
              <span key={p.id}>
                {i > 0 && ", "}
                {name(p)}
              </span>
            ))}
          </p>
        ))}
      </div>
      {open && <PersonSheet person={open} following={open.name === followedName} onClose={() => setOpen(null)} />}
    </>
  );
}

function PersonSheet({ person, following, onClose }: { person: Person; following: boolean; onClose: () => void }) {
  const [state, setState] = useState<"follow" | "avoid" | null>(following ? "follow" : null);
  const [pending, startTransition] = useTransition();

  function choose(kind: "follow" | "avoid") {
    const next = state === kind ? null : kind;
    startTransition(async () => {
      await setPerson(person, next);
      setState(next);
    });
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={person.name} className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        className="flex w-full max-w-md flex-col gap-4 rounded-t-3xl bg-raised p-6 text-fg shadow-xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="label text-muted">{person.role}</p>
            <p className="text-2xl font-black">{person.name}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="-m-2 p-2">
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            aria-pressed={state === "follow"}
            onClick={() => choose("follow")}
            className={cn(
              "h-11 rounded-full border-2 px-5 font-bold",
              state === "follow" ? "border-accent bg-accent text-on-accent" : "border-line hover:bg-soft",
            )}
          >
            {state === "follow" ? "✓ Following" : "Follow"}
          </button>
          <button
            type="button"
            disabled={pending}
            aria-pressed={state === "avoid"}
            onClick={() => choose("avoid")}
            className={cn("h-11 rounded-full border-2 px-5 font-bold", state === "avoid" ? "border-fg bg-fg text-bg" : "border-line hover:bg-soft")}
          >
            {state === "avoid" ? "Avoided" : "Avoid"}
          </button>
        </div>
        <p className="text-sm text-muted">
          {state === "follow"
            ? "Their work ranks higher in every deck, with a badge on the card."
            : state === "avoid"
              ? "Their work won't come up again. Undo any time from People in Saved."
              : "Follow to see more of their work; avoid to never see it."}
        </p>
        <Link href={personHref(person, person.role)} className="self-start text-sm font-bold underline underline-offset-4">
          See all their work →
        </Link>
      </div>
    </div>
  );
}
