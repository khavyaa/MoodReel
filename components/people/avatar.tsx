"use client";

import { useState } from "react";
import type { PhotoRef } from "@/lib/people/types";
import { cn } from "@/lib/cn";

/** TMDb profile photos ("tmdb:/abc.jpg") or Open Library author photos ("ol:123"). */
export function photoUrl(ref: string, size: "sm" | "lg") {
  if (ref.startsWith("tmdb:")) return `https://image.tmdb.org/t/p/${size === "lg" ? "h632" : "w185"}${ref.slice(5)}`;
  // `default=false` makes Open Library answer 404 instead of a blank image, so the initials show.
  return `https://covers.openlibrary.org/a/olid/OL${ref.slice(3)}A-${size === "lg" ? "L" : "M"}.jpg?default=false`;
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

/**
 * A person's photo, round, or their initials when there's no photo or it
 * fails to load. Loaded straight from TMDb / Open Library, like posters.
 */
export function Avatar({ name, photo, size = "sm", className }: { name: string; photo: PhotoRef; size?: "sm" | "lg"; className?: string }) {
  const [failed, setFailed] = useState(false);
  const box = cn(
    "relative shrink-0 overflow-hidden rounded-full bg-soft shadow-[inset_0_0_0_1.5px_var(--line)]",
    size === "lg" ? "size-28 sm:size-36" : "size-12",
    className,
  );
  if (!photo || failed) {
    return (
      <span aria-hidden className={cn(box, "flex items-center justify-center font-black text-muted", size === "lg" ? "text-3xl" : "text-sm")}>
        {initials(name)}
      </span>
    );
  }
  return (
    <span className={box}>
      {/* eslint-disable-next-line @next/next/no-img-element -- straight from the catalogue CDN, like posters */}
      <img
        src={photoUrl(photo, size)}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className="absolute inset-0 size-full object-cover"
      />
    </span>
  );
}
