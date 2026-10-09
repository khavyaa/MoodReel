import { notFound } from "next/navigation";
import { AppFrame } from "@/components/shell/app-frame";
import { MEDIA, MEDIA_SLUGS, MOODS, isMediaSlug } from "@/lib/moods";

export function generateStaticParams() {
  return MEDIA_SLUGS.map((media) => ({ media }));
}

export async function generateMetadata({ params }: PageProps<"/[media]">) {
  const { media } = await params;
  return { title: isMediaSlug(media) ? MEDIA[media].label : "Not found" };
}

/*
 * Phase 1 placeholder. Phase 2 replaces this with the taps → deck → head-to-head
 * → pick flow. It already sits on the mood surface so the shell can be judged.
 */
export default async function MediaPage({ params }: PageProps<"/[media]">) {
  const { media } = await params;
  if (!isMediaSlug(media)) notFound();
  const config = MEDIA[media];
  const mood = config.moods[0];

  return (
    <AppFrame mood={mood}>
      <div className="flex flex-1 flex-col justify-center gap-8">
        <span className="label text-muted">{config.label}</span>
        <h1 className="display max-w-[14ch] text-[clamp(3.5rem,10vw,9rem)]">{config.ask}</h1>
        <ul className="flex flex-wrap gap-2" aria-label="Moods">
          {config.moods.map((id) => (
            <li
              key={id}
              className="flex items-center gap-2 rounded-full border-2 border-line px-4 py-2 text-sm font-semibold"
            >
              {/* The ring keeps a swatch visible on a screen that is already its colour. */}
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
          The taps, the deck and the head-to-head arrive in the next phase. For now this screen shows
          the shell: the mood colour, the type, and the layout on your screen.
        </p>
      </div>
    </AppFrame>
  );
}
