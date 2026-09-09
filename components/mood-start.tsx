"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { LanguageFilter } from "@/components/language-filter";
import { MoodPicker } from "@/components/mood-picker";
import { Button } from "@/components/ui/button";
import { isMoodId, type MoodId } from "@/lib/recommendations/mood-presets";
import { updatePreferences, usePreferences } from "@/lib/use-preferences";
import type { LanguageCode } from "@/lib/types";

/** Mood + language selection, shared by the landing page and the in-app mood tab. */
export function MoodStart({ autoStart = true }: { autoStart?: boolean }) {
  const router = useRouter();
  const preferences = usePreferences();
  const [pendingMood, setPendingMood] = useState<MoodId | null>(null);

  const languages = preferences.languages;
  const mood = pendingMood ?? (isMoodId(preferences.lastMood) ? preferences.lastMood : null);

  function start(next: MoodId) {
    updatePreferences({ lastMood: next });
    router.push(`/app/deck?mood=${next}&languages=${languages.join(",")}`);
  }

  function handleSelect(next: MoodId) {
    setPendingMood(next);
    if (autoStart) start(next);
  }

  function handleLanguages(next: LanguageCode[]) {
    updatePreferences({ languages: next });
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-ink-400">
          Languages
        </h2>
        <LanguageFilter value={languages} onChange={handleLanguages} className="mt-3" />
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-ink-400">
          What are you in the mood for?
        </h2>
        <div className="mt-3">
          <MoodPicker value={mood} onSelect={handleSelect} />
        </div>
      </section>

      {!autoStart && (
        <Button size="lg" className="w-full" disabled={!mood} onClick={() => mood && start(mood)}>
          Start swiping
          <ArrowRight className="size-4" aria-hidden />
        </Button>
      )}
    </div>
  );
}
