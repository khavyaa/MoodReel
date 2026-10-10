import "server-only";
import { tmdb } from "./client";
import { WATCH_REGION } from "./movies";

/** Shorter names for a few services, where TMDb's are long-winded. */
const SHORT_NAME: Record<number, string> = { 119: "Prime Video" };

export function providerName(id: number, tmdbName: string) {
  return SHORT_NAME[id] ?? tmdbName;
}

/** Your services that stream a title, by name, in TMDb's order. */
export function servicesOn(available: { id: number; name: string }[], mine: number[]) {
  return available.filter((p) => mine.includes(p.id)).map((p) => providerName(p.id, p.name));
}

/*
 * Rent-or-buy stores, free-with-ads duplicates and kids' profiles: none of them
 * is a subscription you'd tick. Amazon and Apple "channels" are add-ons and are
 * dropped by name.
 */
const NOT_SUBSCRIPTIONS = new Set([2, 3, 10, 192, 124, 175, 2100, 2285]);

export type Provider = { id: number; name: string; logoPath: string | null };

/** Subscription services TMDb knows in your region, most popular first. */
export async function regionProviders(): Promise<Provider[]> {
  const data = await tmdb<{
    results: { provider_id: number; provider_name: string; logo_path: string | null; display_priorities?: Record<string, number> }[];
  }>("/watch/providers/movie", { watch_region: WATCH_REGION, language: "en-US" }, 60 * 60 * 24);
  return data.results
    .filter((p) => !NOT_SUBSCRIPTIONS.has(p.provider_id) && !/channel$/i.test(p.provider_name.trim()))
    .sort((a, b) => (a.display_priorities?.[WATCH_REGION] ?? 999) - (b.display_priorities?.[WATCH_REGION] ?? 999))
    .map((p) => ({ id: p.provider_id, name: providerName(p.provider_id, p.provider_name), logoPath: p.logo_path }));
}
