"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Check } from "lucide-react";
import { saveServices } from "@/app/(app)/library-actions";
import { cn } from "@/lib/cn";

type Provider = { id: number; name: string; logoPath: string | null };

/** How many to show before "Show all": the big ones, plus anything you've ticked. */
const SHOWN = 12;

export function ServicesPicker({ providers, selected }: { providers: Provider[]; selected: number[] }) {
  const [showAll, setShowAll] = useState(false);
  const [pending, startTransition] = useTransition();
  const [mine, setMine] = useOptimistic(selected);
  const [saved, setSaved] = useState<"saved" | "failed" | null>(null);

  function toggle(id: number) {
    const next = mine.includes(id) ? mine.filter((p) => p !== id) : [...mine, id];
    setSaved(null);
    startTransition(async () => {
      setMine(next);
      try {
        await saveServices(next);
        setSaved("saved");
      } catch {
        setSaved("failed");
      }
    });
  }

  const visible = showAll ? providers : providers.filter((p, i) => i < SHOWN || mine.includes(p.id));

  return (
    <div className="flex flex-col gap-3">
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {visible.map((p) => {
          const on = mine.includes(p.id);
          return (
            <li key={p.id}>
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => toggle(p.id)}
                className={cn(
                  "flex h-12 w-full items-center gap-2.5 rounded-xl border-2 px-2.5 text-left text-sm font-semibold transition-colors",
                  on ? "border-accent" : "border-line hover:bg-soft",
                )}
              >
                {p.logoPath ? (
                  // eslint-disable-next-line @next/next/no-img-element -- tiny logo straight from TMDb's CDN
                  <img src={`https://image.tmdb.org/t/p/w92${p.logoPath}`} alt="" className="size-7 shrink-0 rounded-md" />
                ) : (
                  <span className="size-7 shrink-0 rounded-md bg-soft" />
                )}
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                {on && <Check className="size-4 shrink-0" aria-hidden />}
              </button>
            </li>
          );
        })}
      </ul>
      {providers.length > visible.length && (
        <button type="button" onClick={() => setShowAll(true)} className="self-start text-sm font-semibold underline underline-offset-4">
          Show all {providers.length}
        </button>
      )}
      <p className="text-sm text-muted">
        {mine.length === 0
          ? "None ticked: decks draw from everything, with nothing marked as on your services."
          : `${mine.length} ticked. Films on these come first and get an "On …" badge.`}{" "}
        <span role="status" className="font-semibold text-fg">
          {pending ? "Saving…" : saved === "saved" ? "Saved." : saved === "failed" ? "Couldn't save that. Try again." : ""}
        </span>
      </p>
    </div>
  );
}
