import { Suspense } from "react";
import { DeckClient } from "@/components/deck-client";
import { Spinner } from "@/components/ui/spinner";

export const metadata = { title: "Swipe" };

export default function DeckPage() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-[60vh] place-items-center">
          <Spinner />
        </div>
      }
    >
      <DeckClient />
    </Suspense>
  );
}
