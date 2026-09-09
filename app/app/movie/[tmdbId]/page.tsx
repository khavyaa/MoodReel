import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Play, Star } from "lucide-react";
import { MovieActions } from "@/components/movie-actions";
import { EmptyState } from "@/components/movie-grid";
import { Chip } from "@/components/ui/chip";
import { getMovieDetails, TmdbError } from "@/lib/tmdb";
import { LANGUAGES } from "@/lib/types";
import { backdropUrl, formatRuntime, posterUrl } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/app/movie/[tmdbId]">) {
  const { tmdbId } = await params;
  try {
    const movie = await getMovieDetails(Number(tmdbId));
    return { title: movie.title, description: movie.overview.slice(0, 160) };
  } catch {
    return { title: "Movie" };
  }
}

export default async function MovieDetailsPage({ params }: PageProps<"/app/movie/[tmdbId]">) {
  const { tmdbId } = await params;
  const id = Number(tmdbId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  let movie;
  try {
    movie = await getMovieDetails(id, process.env.TMDB_WATCH_REGION ?? "IN");
  } catch (error) {
    if (error instanceof TmdbError && error.status === 502) notFound();
    return (
      <EmptyState
        title="Movie details unavailable"
        body={
          error instanceof TmdbError
            ? error.message
            : "Something went wrong while loading this film."
        }
      />
    );
  }

  const backdrop = backdropUrl(movie.backdropPath);
  const poster = posterUrl(movie.posterPath, "w342");
  const runtime = formatRuntime(movie.runtime);
  const language = LANGUAGES.find((l) => l.code === movie.language)?.label ?? movie.language;

  return (
    <main className="space-y-8">
      <Link
        href="/app/deck"
        className="inline-flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-100"
      >
        <ArrowLeft className="size-4" aria-hidden /> Back to deck
      </Link>

      {backdrop && (
        <div className="relative -mx-5 aspect-video overflow-hidden">
          <Image
            src={backdrop}
            alt=""
            fill
            sizes="100vw"
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink-950 to-transparent" />
        </div>
      )}

      <section className="flex gap-4">
        {poster && (
          <div className="relative h-40 w-27 shrink-0 overflow-hidden rounded-xl border border-ink-800">
            <Image src={poster} alt={movie.title} fill sizes="110px" className="object-cover" />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold leading-tight tracking-tight">{movie.title}</h1>
          {movie.tagline && <p className="mt-1 text-sm italic text-ink-400">{movie.tagline}</p>}
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-400">
            {movie.year && <span className="font-mono">{movie.year}</span>}
            <span aria-hidden>·</span>
            <span>{language}</span>
            {runtime && (
              <>
                <span aria-hidden>·</span>
                <span>{runtime}</span>
              </>
            )}
          </p>
          {movie.voteCount > 0 && (
            <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-ember-300">
              <Star className="size-4 fill-ember-400 text-ember-400" aria-hidden />
              <span className="font-semibold">{movie.voteAverage.toFixed(1)}</span>
              <span className="text-xs text-ink-500">
                ({movie.voteCount.toLocaleString()} TMDb votes)
              </span>
            </p>
          )}
        </div>
      </section>

      {movie.genres.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {movie.genres.map((genre) => (
            <li key={genre}>
              <Chip>{genre}</Chip>
            </li>
          ))}
        </ul>
      )}

      <MovieActions movie={movie} />

      {movie.overview && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-ink-400">Overview</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-200">{movie.overview}</p>
        </section>
      )}

      {movie.directors.length > 0 && (
        <p className="text-sm text-ink-400">
          <span className="text-ink-500">Directed by </span>
          <span className="text-ink-200">{movie.directors.join(", ")}</span>
        </p>
      )}

      {movie.trailerKey && (
        <a
          href={`https://www.youtube.com/watch?v=${movie.trailerKey}`}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-2 rounded-xl border border-ink-700 bg-ink-900 px-4 py-2.5 text-sm font-medium text-ink-100 hover:bg-ink-850"
        >
          <Play className="size-4 fill-ember-400 text-ember-400" aria-hidden /> Watch trailer
        </a>
      )}

      {movie.cast.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-ink-400">Cast</h2>
          <ul className="no-scrollbar mt-3 flex gap-3 overflow-x-auto pb-1">
            {movie.cast.map((person) => (
              <li key={person.id} className="w-20 shrink-0">
                <div className="relative aspect-[2/3] overflow-hidden rounded-lg border border-ink-800 bg-ink-850">
                  {person.profilePath && (
                    <Image
                      src={posterUrl(person.profilePath, "w185")!}
                      alt={person.name}
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  )}
                </div>
                <p className="mt-1.5 truncate text-[11px] font-medium text-ink-200">{person.name}</p>
                <p className="truncate text-[10px] text-ink-500">{person.character}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {movie.providers.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-ink-400">
            Streaming
          </h2>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {movie.providers.map((provider) => (
              <li key={provider.name}>
                <Chip>{provider.name}</Chip>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-ink-500">
            Availability data from TMDb, powered by JustWatch.
          </p>
        </section>
      )}

      {movie.similar.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-ink-400">
            More like this
          </h2>
          <ul className="no-scrollbar mt-3 flex gap-3 overflow-x-auto pb-1">
            {movie.similar.map((similar) => {
              const similarPoster = posterUrl(similar.posterPath, "w185");
              return (
                <li key={similar.id} className="w-24 shrink-0">
                  <Link href={`/app/movie/${similar.id}`} className="block">
                    <div className="relative aspect-[2/3] overflow-hidden rounded-lg border border-ink-800 bg-ink-850">
                      {similarPoster && (
                        <Image
                          src={similarPoster}
                          alt={similar.title}
                          fill
                          sizes="96px"
                          className="object-cover"
                        />
                      )}
                    </div>
                    <p className="mt-1.5 truncate text-[11px] text-ink-300">{similar.title}</p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <p className="border-t border-ink-800 pt-6 text-[11px] text-ink-500">
        Metadata and images from TMDb. This product uses the TMDb API but is not endorsed or
        certified by TMDb.
      </p>
    </main>
  );
}
