import Link from "next/link";
import { AppFrame } from "@/components/shell/app-frame";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata = { title: "Saved" };

export default function SavedPage() {
  return (
    <AppFrame>
      <EmptyState
        eyebrow="Saved"
        title="Nothing saved yet"
        body="Everything you swipe right on lands here, grouped by movies, series and books, so you can come back to it another night."
        action={
          <Link href="/movies" className={buttonClasses("solid", "lg", "self-start")}>
            Pick something
          </Link>
        }
      />
    </AppFrame>
  );
}
