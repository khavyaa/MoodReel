"use client";

import { useState, useTransition } from "react";
import { LanguageFilter } from "@/components/language-filter";
import { Button } from "@/components/ui/button";
import { updateProfile } from "@/app/app/settings/actions";
import { clearLocalHistory } from "@/lib/local-store";
import { updatePreferences, usePreferences } from "@/lib/use-preferences";
import type { LanguageCode, Profile } from "@/lib/types";

export function SettingsClient({ profile }: { profile: Profile | null }) {
  const preferences = usePreferences();
  const [displayName, setDisplayName] = useState(profile?.displayName ?? "");
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Signed-in users get the profile row as truth; guests only have localStorage.
  const [edited, setEdited] = useState<LanguageCode[] | null>(null);
  const languages = edited ?? profile?.preferredLanguages ?? preferences.languages;

  function save() {
    updatePreferences({ languages });
    if (!profile) {
      setStatus("Saved on this device.");
      return;
    }
    startTransition(async () => {
      const result = await updateProfile({
        displayName: displayName.trim() || null,
        preferredLanguages: languages,
      });
      setStatus(result.message);
    });
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-ink-400">
          Default languages
        </h2>
        <LanguageFilter value={languages} onChange={setEdited} />
        <p className="text-xs text-ink-500">
          New decks start with these languages. You can still change them per session.
        </p>
      </section>

      {profile && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-ink-400">
            Display name
          </h2>
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            maxLength={60}
            className="h-11 w-full rounded-xl border border-ink-700 bg-ink-900 px-3 text-sm text-ink-100 focus:border-ember-400 focus:outline-none"
          />
        </section>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save preferences"}
        </Button>
        {status && (
          <span role="status" className="text-sm text-ink-400">
            {status}
          </span>
        )}
      </div>

      <section className="space-y-3 border-t border-ink-800 pt-8">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-ink-400">
          Local history
        </h2>
        <p className="text-xs leading-relaxed text-ink-500">
          Clears the swipes stored in this browser. Anything already saved to your account stays.
        </p>
        <Button
          variant="danger"
          onClick={() => {
            clearLocalHistory();
            setStatus("Local history cleared.");
          }}
        >
          Clear device history
        </Button>
      </section>
    </div>
  );
}
