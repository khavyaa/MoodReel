import { sql } from "drizzle-orm";
import {
  check,
  index,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
  boolean,
  integer,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

/*
 * Titles are identified by (media, source, external_id), never by a bare id:
 * TMDb movie and TV ids are separate number spaces that overlap, and books come
 * from Open Library. Only ids and your own actions are stored; titles, posters
 * and ratings are fetched fresh, per the TMDb terms.
 */

export const mediaType = pgEnum("media_type", ["movie", "series", "book"]);
export const titleSource = pgEnum("title_source", ["tmdb", "openlibrary"]);

/** What happened, appended once per event. Ratings are not events; see titleStates. */
export const titleAction = pgEnum("title_action", [
  "saved", // right swipe
  "skipped", // left swipe
  "seen", // up swipe: already watched or read
  "disliked", // "not for me"
  "picked", // won the head-to-head
  "unsaved", // removed from the saved list
  "finished", // finished watching a series you picked
  "dropped", // gave up on a series you picked
]);

export const personSource = pgEnum("person_source", ["tmdb", "openlibrary"]);
export const personPrefKind = pgEnum("person_pref", ["follow", "avoid", "dismissed"]);

export const pickStatus = pgEnum("pick_status", ["dealing", "finale", "picked", "empty", "abandoned"]);

/** Append-only log. The taste model learns from this. */
export const titleActions = pgTable(
  "title_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    media: mediaType("media").notNull(),
    source: titleSource("source").notNull(),
    externalId: text("external_id").notNull(),
    action: titleAction("action").notNull(),
    pickSessionId: uuid("pick_session_id").references(() => pickSessions.id, {
      onDelete: "set null",
    }),
    mood: text("mood"),
    language: text("language"),
    /** TMDb genre ids or Open Library subject slugs, kept so taste can be recomputed. */
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("title_actions_user_created_idx").on(t.userId, t.createdAt.desc()),
    index("title_actions_user_title_idx").on(t.userId, t.media, t.source, t.externalId),
  ],
);

/** Current state per title. Rating lives here so changing it never adds taste signal. */
export const titleStates = pgTable(
  "title_states",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    media: mediaType("media").notNull(),
    source: titleSource("source").notNull(),
    externalId: text("external_id").notNull(),
    saved: boolean("saved").notNull().default(false),
    seen: boolean("seen").notNull().default(false),
    skipped: boolean("skipped").notNull().default(false),
    disliked: boolean("disliked").notNull().default(false),
    pickedAt: timestamp("picked_at", { withTimezone: true }),
    /** Series: on your Watching list since this time; null when not watching. */
    watchingSince: timestamp("watching_since", { withTimezone: true }),
    /** Series: when you last answered "still watching?". */
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
    rating: smallint("rating"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.media, t.source, t.externalId] }),
    check("title_states_rating_range", sql`${t.rating} is null or ${t.rating} between 1 and 10`),
    index("title_states_saved_idx").on(t.userId, t.media).where(sql`${t.saved}`),
  ],
);

export type DeckEntry = { source: "tmdb" | "openlibrary"; externalId: string };

/** One run through taps → deck → head-to-head → pick. */
export const pickSessions = pgTable(
  "pick_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    media: mediaType("media").notNull(),
    mood: text("mood").notNull(),
    energy: smallint("energy").notNull(),
    time: smallint("time").notNull(),
    status: pickStatus("status").notNull().default("dealing"),
    deck: jsonb("deck").$type<DeckEntry[]>().notNull().default(sql`'[]'::jsonb`),
    shortlist: jsonb("shortlist").$type<DeckEntry[]>().notNull().default(sql`'[]'::jsonb`),
    pick: jsonb("pick").$type<DeckEntry | null>(),
    /** The one-line "why" shown with the pick, and whether AI or the rules wrote it. */
    why: text("why"),
    whySource: text("why_source"),
    /** "deck" for a normal run, "saved" when the shortlist came from your saved list. */
    origin: text("origin").notNull().default("deck"),
    /** Your answer to "Did you watch it?": watched, later or skipped. Null until asked and answered. */
    followUp: text("follow_up"),
    followedUpAt: timestamp("followed_up_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [index("pick_sessions_user_created_idx").on(t.userId, t.createdAt.desc())],
);

export const preferences = pgTable("preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  region: text("region").notNull().default("IN"),
  /** TMDb watch-provider ids you subscribe to. Starts as Netflix, Prime Video, Apple TV, JioHotstar. */
  providers: integer("providers")
    .array()
    .notNull()
    .default(sql`array[8,119,350,2336]::integer[]`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * New York Times bestseller entries, synced weekly (lib/books/nyt.ts) and
 * matched to Open Library works by ISBN. Shared reference data, not per user.
 */
export const bookSignals = pgTable(
  "book_signals",
  {
    isbn13: text("isbn13").primaryKey(),
    /** Open Library work number (OL…W); null until matched, or when Open Library doesn't know the ISBN. */
    workId: integer("work_id"),
    title: text("title").notNull(),
    author: text("author").notNull(),
    /** The longest run seen on any adult list. */
    weeksOnList: integer("weeks_on_list").notNull().default(0),
    bestRank: integer("best_rank").notNull(),
    lists: text("lists").array().notNull().default(sql`'{}'::text[]`),
    lastSeen: text("last_seen").notNull(),
    matchTried: boolean("match_tried").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("book_signals_work_idx").on(t.workId)],
);

/** Which weekly NYT list dates have been synced, so the backfill can resume. */
export const nytSync = pgTable("nyt_sync", {
  publishedDate: text("published_date").primaryKey(),
  syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * One row per background sync run (the NYT cron), so its outcome can be shown
 * in Settings: Vercel's Hobby plan keeps function logs for only an hour.
 */
export const syncRuns = pgTable(
  "sync_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind").notNull(),
    ranAt: timestamp("ran_at", { withTimezone: true }).notNull().defaultNow(),
    /** What the run did: weeks fetched, entries stored, books matched, errors. */
    report: jsonb("report").$type<Record<string, unknown>>().notNull(),
  },
  (t) => [index("sync_runs_kind_ran_idx").on(t.kind, t.ranAt.desc())],
);

/**
 * People you follow (their work ranks higher), avoid (their work never comes
 * up) or turned down as a suggestion. The name is kept so lists don't need a
 * lookup per person.
 */
export const peoplePrefs = pgTable(
  "people_prefs",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    source: personSource("source").notNull(),
    personId: text("person_id").notNull(),
    name: text("name").notNull(),
    /** What they're known for here: director, creator, writer, actor or author. */
    role: text("role").notNull(),
    kind: personPrefKind("kind").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.source, t.personId] })],
);

/**
 * Books and the films or series made from them: book (Open Library work) ↔
 * screen (TMDb movie or TV id). Shared reference data, synced weekly from
 * Wikidata, plus links found from a film's credits ("Novel by …") when
 * Wikidata has none.
 */
export const adaptations = pgTable(
  "adaptations",
  {
    bookId: integer("book_id").notNull(),
    /** "movie" or "series". */
    media: mediaType("media").notNull(),
    screenId: integer("screen_id").notNull(),
    /** Where the link came from: "wikidata" or "credits". */
    via: text("via").notNull(),
    /** Whether the book id has been checked against Open Library's merged works (Wikidata can name an old one). */
    checked: boolean("checked").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.bookId, t.media, t.screenId] }),
    index("adaptations_screen_idx").on(t.media, t.screenId),
    index("adaptations_unchecked_idx").on(t.bookId).where(sql`not ${t.checked}`),
  ],
);

/**
 * Titles on well-known lists (award winners and the like), synced from
 * Wikidata into the database. Shared reference data, not per user. TMDb's
 * top-rated lists and collections are fetched live, so they aren't stored.
 */
export const listItems = pgTable(
  "list_items",
  {
    /** The list's slug in `lib/lists/catalog.ts`, e.g. "oscar-best-picture". */
    listSlug: text("list_slug").notNull(),
    media: mediaType("media").notNull(),
    /** TMDb id, or Open Library work number for books. */
    externalId: integer("external_id").notNull(),
    /** The year it won or was listed, when Wikidata says: lists show newest first. */
    year: integer("year"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.listSlug, t.media, t.externalId] })],
);

/** Lists you follow: their titles rank a little higher in your decks, with a badge. */
export const listFollows = pgTable(
  "list_follows",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    listSlug: text("list_slug").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.listSlug] })],
);
