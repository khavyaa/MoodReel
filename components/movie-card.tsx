"use client";

import Image from "next/image";
import { Star } from "lucide-react";
import { Chip } from "@/components/ui/chip";
import { LANGUAGES, type MovieCard as MovieCardType } from "@/lib/types";
import { cn, formatRuntime, posterUrl } from "@/lib/utils";

function languageLabel(code: string) {
  return LANGUAGES.find((l) => l.code === code)?.label ?? code.toUpperCase();
}

export function MovieCard({
  movie,
  priority = false,
  className,
}: {
  movie: MovieCardType;
  priority?: boolean;
  className?: string;
}) {
  const poster = posterUrl(movie.posterPath, "w500");
  const runtime = formatRuntime(movie.runtime);

  return (
    <article
      className={cn(
        "relative h-full w-full overflow-hidden rounded-3xl border border-ink-800 bg-ink-900 shadow-2xl shadow-black/60",
        className,
      )}
    >
      {poster ? (
        <Image
          src={poster}
          alt=""
          fill
          priority={priority}
          sizes="(max-width: 640px) 92vw, 420px"
          className="object-cover"
          draggable={false}
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center bg-ink-850 text-ink-600">
          <span className="px-6 text-center text-sm">No poster available</span>
        </div>
      )}

      {/* Legibility scrim: posters vary wildly, so the text needs its own floor. */}
      <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/70 via-40% to-transparent" />

      <div className="absolute inset-x-0 bottom-0 p-5">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink-300">
          {movie.year && <span className="font-mono">{movie.year}</span>}
          <span aria-hidden className="text-ink-600">
            ·
          </span>
          <span>{languageLabel(movie.language)}</span>
          {runtime && (
            <>
              <span aria-hidden className="text-ink-600">
                ·
              </span>
              <span>{runtime}</span>
            </>
          )}
          {movie.voteCount > 0 && (
            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-ink-950/70 px-2 py-1 font-medium text-ember-300">
              <Star className="size-3 fill-ember-400 text-ember-400" aria-hidden />
              {movie.voteAverage.toFixed(1)}
              <span className="sr-only">TMDb rating</span>
            </span>
          )}
        </div>

        <h2 className="mt-2 text-2xl font-semibold leading-tight text-ink-100">{movie.title}</h2>
        {movie.originalTitle !== movie.title && (
          <p className="mt-0.5 text-sm text-ink-400">{movie.originalTitle}</p>
        )}

        {movie.genres.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {movie.genres.slice(0, 3).map((genre) => (
              <li key={genre}>
                <Chip>{genre}</Chip>
              </li>
            ))}
          </ul>
        )}

        {movie.overview && (
          <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-ink-300">
            {movie.overview}
          </p>
        )}
      </div>
    </article>
  );
}
