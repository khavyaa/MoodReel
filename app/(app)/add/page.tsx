import { AppFrame } from "@/components/shell/app-frame";
import { AddScreen } from "@/components/library/add-screen";

export const metadata = { title: "Add what you've seen" };

/** Add what you'd watched or read before MoodReel: a stack of well-known titles, or a search. */
export default function AddPage() {
  return (
    <AppFrame>
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-2">
          <span className="label text-muted">History · Add</span>
          <h1 className="display text-[clamp(3rem,7vw,6rem)]">What you&apos;ve already seen</h1>
          <p className="max-w-[60ch] text-muted">
            Mark films, series and books from before MoodReel. They go into History, teach your taste, and never come up
            in a deck again.
          </p>
        </header>
        <AddScreen />
      </div>
    </AppFrame>
  );
}
