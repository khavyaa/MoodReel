"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { Settings } from "lucide-react";
import { MEDIA_LINKS, PLACES, SETTINGS_HREF, mediaFromPath } from "./nav-items";
import { OfflineBanner } from "./offline-banner";

export function AppHeader() {
  const pathname = usePathname();
  const media = mediaFromPath(pathname);

  return (
    <header className="border-b border-line pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center gap-2 px-5 sm:gap-4 sm:px-8 lg:gap-8 lg:px-12">
        <Link href={`/${media ?? "movies"}`} className="display text-[22px] leading-none sm:text-[26px]">
          MoodReel
        </Link>

        <nav aria-label="Media" className="ml-auto flex gap-1 rounded-full p-1 lg:ml-0">
          {MEDIA_LINKS.map((m) => {
            const active = media === m.slug;
            return (
              <Link
                key={m.slug}
                href={m.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-full px-2.5 py-1.5 text-[13px] font-semibold transition-colors sm:px-4 sm:text-sm",
                  active ? "bg-soft shadow-[inset_0_0_0_1.5px_var(--line)]" : "opacity-70 hover:opacity-100",
                )}
              >
                {m.label}
              </Link>
            );
          })}
        </nav>

        {/* Phone: Settings sits here, so the bottom bar has room for the places. */}
        <Link
          href={SETTINGS_HREF}
          aria-label="Settings"
          aria-current={pathname.startsWith(SETTINGS_HREF) ? "page" : undefined}
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full lg:hidden",
            pathname.startsWith(SETTINGS_HREF) ? "bg-soft" : "opacity-70 hover:opacity-100",
          )}
        >
          <Settings className="size-5" aria-hidden />
        </Link>

        <nav aria-label="Main" className="ml-auto hidden items-center gap-1 lg:flex">
          {PLACES.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                  active ? "bg-soft" : "opacity-70 hover:bg-soft hover:opacity-100",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
      <OfflineBanner />
    </header>
  );
}
