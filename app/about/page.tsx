import Link from "next/link";

export const metadata = { title: "About & credits" };

const CREDITS = [
  {
    name: "The Movie Database (TMDb)",
    href: "https://www.themoviedb.org/",
    body: "Movie and series details, posters and ratings. This product uses the TMDb API but is not endorsed or certified by TMDb.",
  },
  {
    name: "JustWatch",
    href: "https://www.justwatch.com/",
    body: "Where-to-watch availability, provided through TMDb. Availability varies by region and can be out of date.",
  },
  {
    name: "Open Library",
    href: "https://openlibrary.org/",
    body: "Book details, covers and reader ratings, from the Internet Archive's open catalogue.",
  },
  {
    name: "The New York Times",
    href: "https://developer.nytimes.com/",
    body: "Bestseller weeks for books. Data provided by The New York Times.",
  },
];

export default function AboutPage() {
  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-12 px-5 pt-[max(2rem,env(safe-area-inset-top))] pb-16 sm:px-8 lg:px-12 lg:pt-14">
      <Link href="/movies" className="display text-[26px] leading-none">
        MoodReel
      </Link>
      <div className="flex flex-col gap-4">
        <h1 className="display text-[clamp(3rem,8vw,7rem)]">About &amp; credits</h1>
        <p className="max-w-[60ch] text-lg text-muted">
          A personal tool for deciding what to watch or read: three taps, a short deck, one pick. It
          stores only title ids and your own swipes. Titles, posters and ratings are fetched fresh
          from the services below.
        </p>
      </div>
      <ul className="grid gap-6 md:grid-cols-3">
        {CREDITS.map((credit) => (
          <li key={credit.name} className="flex flex-col gap-2 border-t-2 border-line pt-4">
            <a href={credit.href} target="_blank" rel="noreferrer noopener" className="font-bold underline underline-offset-4">
              {credit.name}
            </a>
            <p className="text-sm text-muted">{credit.body}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
