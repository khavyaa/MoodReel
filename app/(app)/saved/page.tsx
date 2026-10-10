import Link from "next/link";
import { Suspense } from "react";
import { AppFrame } from "@/components/shell/app-frame";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LibrarySkeleton } from "@/components/library/library-skeleton";
import { SavedScreen } from "@/components/library/saved-screen";
import { libraryMovies } from "@/lib/library";
import { providersFor, savedMovieIds } from "@/lib/picks/server";
import { requireOwner } from "@/lib/session";

export const metadata = { title: "Saved" };

export default function SavedPage() {
  return (
    <Suspense
      fallback={
        <AppFrame>
          <LibrarySkeleton eyebrow="Saved" />
        </AppFrame>
      }
    >
      <Saved />
    </Suspense>
  );
}

async function Saved() {
  const owner = await requireOwner();
  const saved = await savedMovieIds(owner.id);
  if (saved.length === 0) {
    return (
      <AppFrame>
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
      </AppFrame>
    );
  }

  const details = await libraryMovies(saved.map((s) => s.id), await providersFor(owner.id));
  const movies = saved.flatMap((s) => details.get(s.id) ?? []);
  return <SavedScreen movies={movies} total={saved.length} missing={saved.length - movies.length} />;
}
