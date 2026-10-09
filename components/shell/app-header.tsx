"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { MEDIA_LINKS, PLACES, mediaFromPath } from "./nav-items";

export function AppHeader() {
  const pathname = usePathname();
  const media = mediaFromPath(pathname);

  return (
    <header className="border-b border-line pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center gap-4 px-5 sm:px-8 lg:gap-8 lg:px-12">
        <Link href={`/${media ?? "movies"}`} className="display text-[26px] leading-none">
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
                  "rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors sm:px-4 sm:text-sm",
                  active ? "bg-soft shadow-[inset_0_0_0_1.5px_var(--line)]" : "opacity-70 hover:opacity-100",
                )}
              >
                {m.label}
              </Link>
            );
          })}
        </nav>

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
    </header>
  );
}
