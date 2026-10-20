"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/cn";

const SIZES = { sm: "w185", md: "w342", lg: "w500", xl: "w780" } as const;
/** Open Library cover sizes: "M" is ~180px wide, "L" full size. */
const COVER_SIZES = { sm: "M", md: "M", lg: "L", xl: "L" } as const;

/** TMDb poster paths ("/abc.jpg") or Open Library covers ("ol:12345"). */
export function imageUrl(path: string, size: keyof typeof SIZES) {
  if (path.startsWith("ol:")) return `https://covers.openlibrary.org/b/id/${path.slice(3)}-${COVER_SIZES[size]}.jpg`;
  return `https://image.tmdb.org/t/p/${SIZES[size]}${path}`;
}

function hueOf(text: string) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(h) % 360;
}

/**
 * A TMDb poster or Open Library cover, or a typographic stand-in when there's
 * none or the image fails, so a missing image never leaves an empty box.
 *
 * Loaded straight from TMDb's CDN (`unoptimized`): TMDb already serves exact
 * sizes, and routing through Next's optimizer added a second fetch that could
 * fail and counted against Vercel's free image allowance.
 */
export function Poster({
  title,
  path,
  size = "lg",
  sizes,
  priority = false,
  className,
}: {
  title: string;
  path: string | null;
  size?: keyof typeof SIZES;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = path && !failed;

  return (
    <div
      className={cn(
        "relative aspect-[2/3] w-full overflow-hidden rounded-2xl bg-soft shadow-[0_24px_48px_-24px_rgba(0,0,0,0.55)]",
        className,
      )}
    >
      {showImage ? (
        <Image
          src={imageUrl(path, size)}
          alt={`Poster for ${title}`}
          fill
          sizes={sizes}
          priority={priority}
          unoptimized
          draggable={false}
          onError={() => setFailed(true)}
          className="object-cover select-none"
        />
      ) : (
        <div
          className="@container absolute inset-0 flex items-end p-[8cqi] text-white"
          style={{
            background: `linear-gradient(160deg, hsl(${hueOf(title)} 70% 48%), hsl(${(hueOf(title) + 40) % 360} 68% 20%))`,
          }}
        >
          <span className="font-[family-name:var(--font-shoulders)] text-[15cqi] leading-[0.86] font-black uppercase">
            {title}
          </span>
        </div>
      )}
    </div>
  );
}
