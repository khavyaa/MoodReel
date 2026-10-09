/**
 * A Google search for where to watch a title. Google's own "where to watch"
 * panel is more current than TMDb's provider list, and it covers rentals too.
 */
export function watchSearchUrl(title: string, year: number | null, media: "movie" | "series" = "movie") {
  const q = [title, year, media === "movie" ? "movie" : "series", "where to watch"].filter(Boolean).join(" ");
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}
