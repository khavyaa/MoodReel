"use client";

import { useEffect } from "react";

/**
 * Registers public/sw.js in production, so the home-screen app opens offline.
 * Not in development: a service worker caching dev builds only gets in the way.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // No service worker means no offline copies; the app works the same online.
    });
  }, []);
  return null;
}

/** On sign-out: drop the pages kept for offline, so nothing personal stays on the device. */
export async function forgetOfflinePages() {
  try {
    navigator.serviceWorker?.controller?.postMessage("forget-pages");
    await caches?.delete("moodreel-pages");
  } catch {
    // Nothing kept, or no access to caches: nothing to forget.
  }
}
