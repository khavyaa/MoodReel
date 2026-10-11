import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ReadingCheck, SeriesCheck, WatchCheck } from "@/components/library/watch-check";
import { PickFlow } from "@/components/pick/pick-flow";
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
  const check = media === "movies" ? <WatchCheck /> : media === "series" ? <SeriesCheck /> : <ReadingCheck />;
  return <PickFlow media={MEDIA[media].media} notice={<Suspense fallback={null}>{check}</Suspense>} />;
}
