"use client";

import { useEffect, useState } from "react";
import { imageUrl } from "@/components/pick/poster";
import { tintOf } from "@/lib/tint";

/** A poster's colour (see lib/tint.ts), or null until it's known or when it can't be read. */
export function usePosterColour(path: string | null | undefined): string | null {
  const [found, setFound] = useState<{ path: string; colour: string | null } | null>(null);
  useEffect(() => {
    if (!path) return;
    let live = true;
    tintOf(imageUrl(path, "sm")).then((colour) => live && setFound({ path, colour }));
    return () => {
      live = false;
    };
  }, [path]);
  return path && found?.path === path ? found.colour : null;
}
