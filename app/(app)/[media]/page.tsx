import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SeriesCheck, WatchCheck } from "@/components/library/watch-check";
import { AppFrame } from "@/components/shell/app-frame";
import { PickFlow } from "@/components/pick/pick-flow";
import { MEDIA, MEDIA_SLUGS, MOODS, isMediaSlug } from "@/lib/moods";

export function generateStaticParams() {
  return MEDIA_SLUGS.map((media) => ({ media }));
}

export async function generateMetadata({ params }: PageProps<"/[media]">) {
  const { media } = await params;
  return { title: isMediaSlug(media) ? MEDIA[media].label : "Not found" };
}

export default async function MediaPage({ params }: PageProps<"/[media]">) {
  const { media } = await params;
  if (!isMediaSlug(media)) notFound();
  if (media === "movies" || media === "series") {
    return (
      <PickFlow
        media={MEDIA[media].media as "movie" | "series"}
        notice={<Suspense fallback={null}>{media === "movies" ? <WatchCheck /> : <SeriesCheck />}</Suspense>}
      />
    );
  }

  // Books arrive in Phase 4.
  const config = MEDIA[media];
  return (
    <AppFrame mood={config.moods[0]}>
      <div className="flex flex-1 flex-col justify-center gap-8">
        <span className="label text-muted">{config.label} · coming next</span>
        <h1 className="display max-w-[14ch] text-[clamp(3.5rem,10vw,9rem)]">{config.ask}</h1>
        <ul className="flex flex-wrap gap-2" aria-label="Moods">
          {config.moods.map((id) => (
            <li key={id} className="flex items-center gap-2 rounded-full border-2 border-line px-4 py-2 text-sm font-semibold">
              <span
                className="size-3.5 rounded-full shadow-[0_0_0_2px_color-mix(in_srgb,currentColor_35%,transparent)]"
                style={{ background: MOODS[id].color }}
                aria-hidden
              />
              {MOODS[id].label}
            </li>
          ))}
        </ul>
        <p className="max-w-[52ch] text-muted">
          Books come next: English titles from Open Library, with length instead of runtime.
        </p>
      </div>
    </AppFrame>
  );
}
