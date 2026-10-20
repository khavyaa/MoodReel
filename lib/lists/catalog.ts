/*
 * The lists MoodReel knows. Award winners come from Wikidata (synced into
 * `list_items`); TMDb's top-rated lists and film collections are fetched live.
 * IMDb's lists have no free API (and its terms forbid scraping), and AFI 100,
 * 1001 Movies / Books and Sight & Sound aren't recorded in Wikidata in a
 * usable form, so they aren't here.
 */

export type ListMedia = "movie" | "series" | "book";

export type ListSource =
  /** Titles that received a Wikidata award item (P166), with their TMDb (P4947) or Open Library (P648) id. */
  | { kind: "wikidata"; award: string }
  /** TMDb's own top-rated list, `pages` × 20 titles. */
  | { kind: "tmdb-top"; pages: number }
  /** A TMDb film collection (a franchise or series of films), in release order. */
  | { kind: "collection"; id: number };

export type ListDef = {
  slug: string;
  title: string;
  /** For a card's badge: "On Oscar Best Picture". */
  short: string;
  media: ListMedia;
  blurb: string;
  source: ListSource;
};

export const LISTS: ListDef[] = [
  {
    slug: "oscar-best-picture",
    title: "Oscar Best Picture winners",
    short: "Oscar Best Picture",
    media: "movie",
    blurb: "Every Academy Award for Best Picture, newest first.",
    source: { kind: "wikidata", award: "Q102427" },
  },
  {
    slug: "palme-dor",
    title: "Palme d'Or winners",
    short: "Palme d'Or",
    media: "movie",
    blurb: "The top prize at Cannes.",
    source: { kind: "wikidata", award: "Q179808" },
  },
  {
    slug: "national-film-award",
    title: "National Film Award: Best Feature Film",
    short: "National Film Award",
    media: "movie",
    blurb: "India's highest film honour, across every language.",
    source: { kind: "wikidata", award: "Q1435633" },
  },
  {
    slug: "tmdb-top-films",
    title: "Top rated films",
    short: "Top rated",
    media: "movie",
    blurb: "TMDb's highest-rated films, by its users' votes.",
    source: { kind: "tmdb-top", pages: 13 },
  },
  {
    slug: "tmdb-top-series",
    title: "Top rated series",
    short: "Top rated",
    media: "series",
    blurb: "TMDb's highest-rated series, by its users' votes.",
    source: { kind: "tmdb-top", pages: 5 },
  },
  {
    slug: "booker",
    title: "Booker Prize winners",
    short: "Booker Prize",
    media: "book",
    blurb: "The best novel in English each year.",
    source: { kind: "wikidata", award: "Q160082" },
  },
  {
    slug: "international-booker",
    title: "International Booker Prize winners",
    short: "International Booker",
    media: "book",
    blurb: "The best novel translated into English.",
    source: { kind: "wikidata", award: "Q2052291" },
  },
  {
    slug: "pulitzer-fiction",
    title: "Pulitzer Prize for Fiction",
    short: "Pulitzer Prize",
    media: "book",
    blurb: "American fiction's top prize, since 1918.",
    source: { kind: "wikidata", award: "Q833633" },
  },
  {
    slug: "hugo-novel",
    title: "Hugo Award: Best Novel",
    short: "Hugo Award",
    media: "book",
    blurb: "Science fiction and fantasy, voted by readers.",
    source: { kind: "wikidata", award: "Q255032" },
  },
];

const COLLECTION = /^collection-(\d+)$/;

/** A collection's list: "collection-<TMDb collection id>", titled from TMDb when shown. */
export const collectionSlug = (id: number) => `collection-${id}`;

/** The list for a slug: a known list, or a TMDb collection (title filled in later). */
export function listBySlug(slug: string): ListDef | null {
  const known = LISTS.find((l) => l.slug === slug);
  if (known) return known;
  const m = slug.match(COLLECTION);
  if (!m) return null;
  return {
    slug,
    title: "Collection",
    short: "Collection",
    media: "movie",
    blurb: "A series of films, in release order.",
    source: { kind: "collection", id: Number(m[1]) },
  };
}
