"use client";

import { useCallback, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { CoverFlow, type FlowItem } from "./cover-flow";

export type FlowPage = { items: FlowItem[]; infos: ReactNode[] };

/**
 * A cover flow over a long list rendered on the server a page at a time: the
 * first page comes with the page, the rest from `load(offset)` (a server action
 * that returns the next titles ready to show) as you near the end.
 */
export function MoreFlow({
  first,
  total,
  load,
  ...flow
}: { first: FlowPage; total: number; load: (offset: number) => Promise<FlowPage> } & Omit<
  ComponentProps<typeof CoverFlow>,
  "items" | "infos" | "total" | "onNearEnd"
>) {
  const [pages, setPages] = useState<FlowPage>(first);
  const loading = useRef(false);
  const nearEnd = useCallback(() => {
    if (loading.current) return;
    loading.current = true;
    load(pages.items.length)
      .then((next) => setPages((all) => ({ items: [...all.items, ...next.items], infos: [...all.infos, ...next.infos] })))
      .catch(() => undefined)
      .finally(() => (loading.current = false));
  }, [load, pages.items.length]);
  return <CoverFlow {...flow} items={pages.items} infos={pages.infos} total={total} onNearEnd={nearEnd} />;
}
