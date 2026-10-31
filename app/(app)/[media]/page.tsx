import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MovieCheck, ReadingCheck, SeriesCheck } from "@/components/library/watch-check";
import { PickFlow } from "@/components/pick/pick-flow";
import { AppFrame } from "@/components/shell/app-frame";
import { MEDIA, MEDIA_SLUGS, isMediaSlug } from "@/lib/moods";

export function generateStaticParams() {
  return MEDIA_SLUGS.map((media) => ({ media }));
}

export async function generateMetadata({ params }: PageProps<"/[media]">) {
  const { media } = await params;
  return { title: isMediaSlug(media) ? MEDIA[media].label : "Not found" };
}

/** The pick flow for films, series or books, with that media's "how's it going?" card on the start screen. */
export default async function MediaPage({ params }: PageProps<"/[media]">) {
  const { media } = await params;
  if (!isMediaSlug(media)) notFound();
  const check = media === "movies" ? <MovieCheck /> : media === "series" ? <SeriesCheck /> : <ReadingCheck />;
  // The flow reads "?with=" (deal from a person), so it renders per request.
  return (
    <Suspense
      fallback={
        // The question shows at once (it never changes); the choices follow a moment later.
        <AppFrame mood={MEDIA[media].moods[0]}>
          <h1 className="display text-[clamp(2.75rem,min(8.5vw,10dvh),7.5rem)]">{MEDIA[media].ask}</h1>
          <p role="status" className="mt-6 text-muted">
            Getting your moods ready…
          </p>
        </AppFrame>
      }
    >
      <PickFlow media={MEDIA[media].media} notice={<Suspense fallback={null}>{check}</Suspense>} />
    </Suspense>
  );
}
