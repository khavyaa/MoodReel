"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { PICK, PLACES, SETTINGS_HREF, mediaFromPath } from "./nav-items";

/** Phone only: picking and the places, in thumb reach (Settings is in the top bar). Laptops use the header. */
export function BottomNav() {
  const pathname = usePathname();
  const media = mediaFromPath(pathname);
  const items = [
    { href: `/${media ?? "movies"}`, label: PICK.label, icon: PICK.icon, active: media !== null },
    ...PLACES.filter((p) => p.href !== SETTINGS_HREF).map((p) => ({ ...p, active: pathname.startsWith(p.href) })),
  ];

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
    >
      <ul className="mx-auto flex max-w-lg">
        {items.map(({ href, label, icon: Icon, active }) => (
          <li key={label} className="flex-1">
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-1 py-2 text-xs",
                // Inactive places stay in full ink (readable on every mood colour); the current one is bolder.
                active ? "font-black" : "font-medium",
              )}
            >
              <Icon className="size-5" strokeWidth={active ? 2.4 : 1.8} aria-hidden />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
