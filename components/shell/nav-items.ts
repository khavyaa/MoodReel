import { Bookmark, History, Settings, Sparkles, Users } from "lucide-react";
import { MEDIA, MEDIA_SLUGS, type MediaSlug } from "@/lib/moods";

/** The places beside picking. On a phone Settings lives in the top bar, so the bottom bar has room. */
export const PLACES = [
  { href: "/saved", label: "Saved", icon: Bookmark },
  { href: "/history", label: "History", icon: History },
  { href: "/people", label: "People", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export const SETTINGS_HREF = "/settings";

export const PICK = { label: "Pick", icon: Sparkles } as const;

export const MEDIA_LINKS = MEDIA_SLUGS.map((slug) => ({ slug, href: `/${slug}`, label: MEDIA[slug].label }));

/** Which media page you're on, if any. */
export function mediaFromPath(pathname: string): MediaSlug | null {
  const first = pathname.split("/")[1] as MediaSlug;
  return MEDIA_SLUGS.includes(first) ? first : null;
}
