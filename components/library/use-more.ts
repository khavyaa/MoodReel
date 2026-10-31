"use client";

import { useCallback, useRef, useState } from "react";

/**
 * A list a flow shows a page at a time: starts with the first page, asks for
 * the next as the flow nears its end, and lets cards leave (Saved → Seen it).
 * Offsets count rows fetched from the database, less those that have left
 * since, so a page never skips titles that slid up into the gap. `rows` is how
 * many rows there are in all; `shown`, how many of them will be cards (fewer
 * when some titles can't load and are listed apart).
 */
export function useMore<T>(
  first: T[],
  firstFetched: number,
  rows: number,
  load: (offset: number) => Promise<{ list: T[]; fetched: number }>,
  shown = rows,
) {
  const total = rows;
  const [list, setList] = useState(first);
  const fetched = useRef(firstFetched);
  const left = useRef(0);
  const loading = useRef(false);
  const [done, setDone] = useState(firstFetched >= total);
  const [gone, setGone] = useState(0);

  const nearEnd = useCallback(() => {
    if (loading.current || done) return;
    loading.current = true;
    load(fetched.current - left.current)
      .then((next) => {
        fetched.current += next.fetched;
        if (next.fetched === 0 || fetched.current >= total) setDone(true);
        setList((all) => [...all, ...next.list]);
      })
      .catch(() => undefined)
      .finally(() => (loading.current = false));
  }, [load, total, done]);

  /** Take one card out (it's been seen, removed or turned down). */
  const remove = useCallback((isIt: (item: T) => boolean) => {
    left.current += 1;
    setGone((n) => n + 1);
    setList((all) => all.filter((item) => !isIt(item)));
  }, []);

  /** Put a card back where it was (Undo). */
  const putBack = useCallback((item: T, at: number) => {
    left.current -= 1;
    setGone((n) => n - 1);
    setList((all) => [...all.slice(0, at), item, ...all.slice(at)]);
  }, []);

  return { list, nearEnd, remove, putBack, total: Math.max(0, shown - gone) };
}
