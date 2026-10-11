/**
 * A Google search for where to watch a title. Google's own "where to watch"
 * panel is more current than TMDb's provider list, and it covers rentals too.
 */
export function watchSearchUrl(title: string, year: number | null, media: "movie" | "series" = "movie") {
  const q = [title, year, media === "movie" ? "movie" : "series", "where to watch"].filter(Boolean).join(" ");
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

/** Amazon India's books section, searched for the title and first author: paper copies, price and delivery. */
export function bookSearchUrl(title: string, authors: string[]) {
  const q = [title, authors[0]].filter(Boolean).join(" ");
  return `https://www.amazon.in/s?k=${encodeURIComponent(q)}&i=stripbooks`;
}

/** "Where to watch" for films and series, "Where to get it" for books. */
export function whereTo(card: { media: "movie" | "series" | "book"; title: string; year: number | null; book: { authors: string[] } | null }) {
  return card.media === "book"
    ? { label: "Where to get it", href: bookSearchUrl(card.title, card.book?.authors ?? []) }
    : { label: "Where to watch", href: watchSearchUrl(card.title, card.year, card.media) };
}
