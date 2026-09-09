"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bookmark, Check, Layers, Settings, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/app", label: "Mood", icon: Sparkles, exact: true },
  { href: "/app/deck", label: "Swipe", icon: Layers, exact: false },
  { href: "/app/watchlist", label: "Watchlist", icon: Bookmark, exact: false },
  { href: "/app/watched", label: "Watched", icon: Check, exact: false },
  { href: "/app/settings", label: "Settings", icon: Settings, exact: false },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="sticky bottom-0 z-40 border-t border-ink-800 bg-ink-950/95 backdrop-blur supports-[backdrop-filter]:bg-ink-950/80 pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-lg items-stretch">
        {TABS.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium tracking-wide transition-colors",
                  active ? "text-ember-400" : "text-ink-400 hover:text-ink-100",
                )}
              >
                <Icon className="size-5" strokeWidth={active ? 2.4 : 1.8} aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
