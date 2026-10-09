import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col justify-center gap-6 px-5 py-16 sm:px-8 lg:px-12">
      <span className="label text-muted">404</span>
      <h1 className="display text-[clamp(3rem,9vw,8rem)]">Nothing playing here</h1>
      <p className="max-w-[48ch] text-lg text-muted">That page doesn&apos;t exist. Head back and pick something.</p>
      <Link href="/movies" className={buttonClasses("solid", "lg", "self-start")}>
        Back to MoodReel
      </Link>
    </main>
  );
}
