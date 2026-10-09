import Link from "next/link";
import { Suspense } from "react";
import { AppFrame } from "@/components/shell/app-frame";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SavedList } from "@/components/library/library-lists";
import { LibrarySkeleton } from "@/components/library/library-skeleton";
import { libraryMovies } from "@/lib/library";
import { savedMovieIds } from "@/lib/picks/server";
import { requireOwner } from "@/lib/session";

export const metadata = { title: "Saved" };

export default function SavedPage() {
  return (
    <AppFrame>
      <Suspense fallback={<LibrarySkeleton eyebrow="Saved" />}>
        <Saved />
      </Suspense>
    </AppFrame>
  );
}

async function Saved() {
  const owner = await requireOwner();
  const saved = await savedMovieIds(owner.id);
  if (saved.length === 0) {
    return (
      <EmptyState
        eyebrow="Saved"
        title="Nothing saved yet"
        body="Everything you swipe right on and don't pick lands here, so you can come back to it another night."
        action={
          <Link href="/movies" className={buttonClasses("solid", "lg", "self-start")}>
            Pick something
          </Link>
        }
      />
    );
  }

  const details = await libraryMovies(saved.map((s) => s.id));
  const movies = saved.flatMap((s) => details.get(s.id) ?? []);
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <span className="label text-muted">Saved · {saved.length} {saved.length === 1 ? "film" : "films"}</span>
        <h1 className="display text-[clamp(3rem,7vw,6rem)]">For another night</h1>
      </header>
      <SavedList movies={movies} />
      {movies.length < saved.length && (
        <p className="text-sm text-muted">
          {saved.length - movies.length} couldn&apos;t load from the movie database just now.
        </p>
      )}
    </div>
  );
}
