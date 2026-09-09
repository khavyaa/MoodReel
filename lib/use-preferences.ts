"use client";

import { useSyncExternalStore } from "react";
import {
  DEFAULT_PREFERENCES,
  readPreferences,
  writePreferences,
  type Preferences,
} from "@/lib/local-store";

/*
 * localStorage is an external store, so it is read through useSyncExternalStore
 * rather than an effect. That keeps the server render (defaults) and the first
 * client render consistent without a setState-in-effect round trip.
 */

const listeners = new Set<() => void>();
let snapshot: Preferences | null = null;

function getSnapshot(): Preferences {
  if (!snapshot) snapshot = readPreferences();
  return snapshot;
}

function getServerSnapshot(): Preferences {
  return DEFAULT_PREFERENCES;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function updatePreferences(patch: Partial<Preferences>) {
  const current = getSnapshot();
  const next = { ...current, ...patch };
  // A no-op write must not produce a new snapshot: subscribers key effects off
  // this object, and a fresh identity every write would loop them forever.
  if (
    next.lastMood === current.lastMood &&
    next.languages.join(",") === current.languages.join(",")
  ) {
    return;
  }

  writePreferences(patch);
  snapshot = readPreferences();
  for (const listener of listeners) listener();
}

export function usePreferences(): Preferences {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
