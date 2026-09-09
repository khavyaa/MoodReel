"use client";

import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";
import type { MovieCard as MovieCardType } from "@/lib/types";
import { cn, posterUrl } from "@/lib/utils";

export function MovieGrid({
  movies,
  renderActions,
}: {
  movies: MovieCardType[];
  renderActions?: (movie: MovieCardType) => React.ReactNode;
}) {
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {movies.map((movie) => {
        const poster = posterUrl(movie.posterPath, "w342");
        return (
          <li key={movie.id} className="flex flex-col gap-2">
            <Link
              href={`/app/movie/${movie.id}`}
              className="group relative block aspect-[2/3] overflow-hidden rounded-2xl border border-ink-800 bg-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember-300"
            >
              {poster ? (
                <Image
                  src={poster}
                  alt={movie.title}
                  fill
                  sizes="(max-width: 640px) 45vw, 200px"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <span className="grid h-full place-items-center px-3 text-center text-xs text-ink-500">
                  {movie.title}
                </span>
              )}
              {movie.voteCount > 0 && (
                <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-ink-950/80 px-2 py-0.5 text-[10px] font-medium text-ember-300">
                  <Star className="size-2.5 fill-ember-400 text-ember-400" aria-hidden />
                  {movie.voteAverage.toFixed(1)}
                </span>
              )}
            </Link>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink-100">{movie.title}</p>
              <p className="text-xs text-ink-400">
                {movie.year ?? "—"} · {movie.language.toUpperCase()}
              </p>
            </div>
            {renderActions?.(movie)}
          </li>
        );
      })}
    </ul>
  );
}

export function EmptyState({
  title,
  body,
  action,
  className,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-dashed border-ink-800 bg-ink-900/60 px-6 py-12 text-center",
        className,
      )}
    >
      <h2 className="text-base font-semibold text-ink-100">{title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-400">{body}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
