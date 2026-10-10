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
]);

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
