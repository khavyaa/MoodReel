import "server-only";
import { and, desc, eq, gt, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { pickSessions, preferences, titleActions, titleStates } from "@/lib/db/schema";
import { buildTasteProfile, type ActionKind } from "@/lib/taste/profile";
import { foldActions } from "./state";
import type { TasteProfile } from "@/lib/taste/rules";

/*
 * Reads and writes for the pick flow. Every function takes the owner id from
 * the verified session (lib/session.ts) and scopes every query by it. Titles
 * are keyed by (media, source, external id): TMDb movie and TV ids overlap.
 */

export type Media = "movie" | "series" | "book";
/** Where a media type's ids come from: TMDb for films and series, Open Library for books. */
export const sourceOf = (media: Media) => (media === "book" ? ("openlibrary" as const) : ("tmdb" as const));

/** A skip means "not tonight", not "never": it hides a title for this long. */
export const SKIP_COOLDOWN_DAYS = 60;

function titleKey(userId: string, media: Media, id: number | string) {
  return and(
    eq(titleStates.userId, userId),
    eq(titleStates.media, media),
    eq(titleStates.source, sourceOf(media)),
    eq(titleStates.externalId, String(id)),
  );
}

function actionKey(userId: string, media: Media, id: number | string) {
  return and(
    eq(titleActions.userId, userId),
    eq(titleActions.media, media),
    eq(titleActions.source, sourceOf(media)),
    eq(titleActions.externalId, String(id)),
  );
}

/** Ids you've already dealt with: seen, disliked, saved, picked, or skipped recently. */
export async function handledIds(userId: string, media: Media): Promise<Set<number>> {
  const rows = await getDb()
    .select({ id: titleStates.externalId })
    .from(titleStates)
    .where(
      and(
        eq(titleStates.userId, userId),
        eq(titleStates.media, media),
        eq(titleStates.source, sourceOf(media)),
        or(
          eq(titleStates.seen, true),
          eq(titleStates.disliked, true),
          eq(titleStates.saved, true),
          isNotNull(titleStates.pickedAt), // includes every series on your Watching list
          and(
            eq(titleStates.skipped, true),
            gt(titleStates.updatedAt, sql`now() - make_interval(days => ${SKIP_COOLDOWN_DAYS})`),
          ),
        ),
      ),
    );
  return new Set(rows.map((r) => Number(r.id)));
}

/** Taste per media: TV and film genre ids share numbers but not meaning. */
export async function tasteFor(userId: string, media: Media): Promise<TasteProfile> {
  const rows = await getDb()
    .select({ action: titleActions.action, tags: titleActions.tags })
    .from(titleActions)
    .where(and(eq(titleActions.userId, userId), eq(titleActions.media, media)))
    .orderBy(desc(titleActions.createdAt))
    .limit(500);
  return buildTasteProfile(rows as { action: ActionKind; tags: string[] }[]);
}

export async function createDeckSession(
  userId: string,
  media: Media,
  taps: { mood: string; energy: number; time: number },
  ids: number[],
) {
  // Only the newest deck can be resumed: dealing a new one closes the unfinished ones.
  await getDb()
    .update(pickSessions)
    .set({ status: "abandoned" })
    .where(and(eq(pickSessions.userId, userId), eq(pickSessions.media, media), eq(pickSessions.status, "dealing")));
  const [row] = await getDb()
    .insert(pickSessions)
    .values({
      userId,
      media,
      mood: taps.mood,
      energy: taps.energy,
      time: taps.time,
      status: ids.length ? "dealing" : "empty",
      deck: ids.map((id) => ({ source: sourceOf(media), externalId: String(id) })),
    })
    .returning({ id: pickSessions.id });
  return row.id;
}

async function ownedSession(userId: string, sessionId: string) {
  const session = await getDb().query.pickSessions.findFirst({
    where: and(eq(pickSessions.id, sessionId), eq(pickSessions.userId, userId)),
  });
  if (!session) throw new Error("That deck isn't yours, or it no longer exists.");
  return session as typeof session & { media: Media };
}

export type SwipeAction = "saved" | "skipped" | "seen" | "disliked";
type TitleRef = { id: number; language: string; genreIds: number[]; tags?: string[] };

/** Taste tags: genre ids and language for films and series; books send subject tags. */
function tagsFor(title: TitleRef) {
  return title.tags?.length ? title.tags : [...title.genreIds.map(String), `lang:${title.language}`];
}

async function logAction(
  userId: string,
  media: Media,
  sessionId: string | null,
  mood: string | null,
  title: TitleRef,
  action: ActionKind,
  state: Partial<typeof titleStates.$inferInsert>,
) {
  const db = getDb();
  const key = { userId, media, source: sourceOf(media), externalId: String(title.id) };
  await db.transaction(async (tx) => {
    await tx.insert(titleActions).values({
      ...key,
      action,
      pickSessionId: sessionId,
      mood,
      language: title.language,
      tags: tagsFor(title),
    });
    await tx
      .insert(titleStates)
      .values({ ...key, ...state, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [titleStates.userId, titleStates.media, titleStates.source, titleStates.externalId],
        set: { ...state, updatedAt: new Date() },
      });
  });
}

export async function recordSwipe(userId: string, sessionId: string, title: TitleRef, action: SwipeAction) {
  const session = await ownedSession(userId, sessionId);
  const state = {
    saved: { saved: true, skipped: false },
    skipped: { skipped: true },
    seen: { seen: true, saved: false },
    disliked: { disliked: true, saved: false },
  }[action];
  await logAction(userId, session.media, sessionId, session.mood, title, action, state);

  if (action === "saved") {
    const entry = { source: sourceOf(session.media), externalId: String(title.id) };
    if (!session.shortlist.some((e) => e.externalId === entry.externalId)) {
      await getDb()
        .update(pickSessions)
        .set({ shortlist: [...session.shortlist, entry] })
        .where(eq(pickSessions.id, sessionId));
    }
  }
}

const SWIPES: ActionKind[] = ["saved", "skipped", "seen", "disliked"];

/**
 * Takes back the last swipe on a title in this deck: deletes that action and
 * rebuilds the title's state from whatever is left in its log.
 */
export async function undoSwipe(userId: string, sessionId: string, titleId: number) {
  const session = await ownedSession(userId, sessionId);
  const db = getDb();
  const externalId = String(titleId);
  const sameTitle = actionKey(userId, session.media, externalId);
  const last = await db.query.titleActions.findFirst({
    where: and(sameTitle, eq(titleActions.pickSessionId, sessionId), inArray(titleActions.action, SWIPES)),
    orderBy: desc(titleActions.createdAt),
  });
  if (!last) return;

  await db.transaction(async (tx) => {
    await tx.delete(titleActions).where(eq(titleActions.id, last.id));
    const rest = await tx
      .select({ action: titleActions.action, createdAt: titleActions.createdAt })
      .from(titleActions)
      .where(sameTitle)
      .orderBy(titleActions.createdAt);
    const stateKey = titleKey(userId, session.media, externalId);
    const current = await tx.query.titleStates.findFirst({ where: stateKey });
    if (rest.length === 0 && current?.rating == null && current?.watchingSince == null) {
      await tx.delete(titleStates).where(stateKey);
    } else {
      // updatedAt goes back too: the skip cooldown counts from it.
      const updatedAt = rest.at(-1)?.createdAt ?? new Date();
      await tx.update(titleStates).set({ ...foldActions(rest), updatedAt }).where(stateKey);
    }
    if (last.action === "saved") {
      await tx
        .update(pickSessions)
        .set({ shortlist: session.shortlist.filter((e) => e.externalId !== externalId) })
        .where(eq(pickSessions.id, sessionId));
    }
  });
}

/** The pick moves from "saved" into history (a series or book onto your Watching or Reading list); the other saves stay saved. */
export async function completePick(
  userId: string,
  sessionId: string,
  title: TitleRef,
  why: { text: string; source: "ai" | "rules" },
) {
  const session = await ownedSession(userId, sessionId);
  const now = new Date();
  await logAction(userId, session.media, sessionId, session.mood, title, "picked", {
    pickedAt: now,
    saved: false,
    ...(session.media !== "movie" ? { watchingSince: now, checkedInAt: null } : {}),
  });
  await getDb()
    .update(pickSessions)
    .set({
      status: "picked",
      pick: { source: sourceOf(session.media), externalId: String(title.id) },
      why: why.text,
      whySource: why.source,
      completedAt: now,
    })
    .where(eq(pickSessions.id, sessionId));
}

export async function markSessionEmpty(userId: string, sessionId: string) {
  await ownedSession(userId, sessionId);
  await getDb()
    .update(pickSessions)
    .set({ status: "empty", completedAt: new Date() })
    .where(eq(pickSessions.id, sessionId));
}

/** Save a title outside any deck, from a person's page. */
export async function saveOutsideDeck(userId: string, media: Media, title: TitleRef) {
  await logAction(userId, media, null, null, title, "saved", { saved: true, skipped: false });
}

/** "I've read it" or "I've seen it" from outside a deck: the same as that swipe. */
export async function markSeenOutsideDeck(userId: string, media: Media, title: TitleRef) {
  await logAction(userId, media, null, null, title, "seen", { seen: true, saved: false });
}

/* ------------------------------------------------------- saved and history */

export type LibraryAction = "unsaved" | "seen" | "finished" | "dropped";

type StateChange = Partial<
  Pick<typeof titleStates.$inferInsert, "saved" | "seen" | "disliked" | "rating" | "watchingSince" | "checkedInAt">
>;

/**
 * A change made from Saved, History or a check-in, outside any deck. Actions go
 * in the log with the tags the title was first logged with, so taste stays
 * consistent; a rating only touches the title's state.
 */
export async function updateTitleState(
  userId: string,
  media: Media,
  id: number,
  action: LibraryAction | null,
  state: StateChange,
) {
  const db = getDb();
  const current = await db.query.titleStates.findFirst({ where: titleKey(userId, media, id) });
  if (!current) throw new Error("That title isn't in your library.");

  const earlier = await db.query.titleActions.findFirst({
    where: actionKey(userId, media, id),
    orderBy: desc(titleActions.createdAt),
  });

  await db.transaction(async (tx) => {
    if (action) {
      await tx.insert(titleActions).values({
        userId,
        media,
        source: sourceOf(media),
        externalId: String(id),
        action,
        language: earlier?.language ?? null,
        tags: earlier?.tags ?? [],
      });
    }
    await tx
      .update(titleStates)
      .set({ ...state, updatedAt: new Date() })
      .where(titleKey(userId, media, id));
  });
}

/** How many lists show at first, and how many more each "Show more" adds. */
export const LIST_PAGE = 60;

/** Everything you swiped right on and haven't picked or removed, newest first; of one kind if `media` is given. */
export async function savedTitles(userId: string, limit = LIST_PAGE, media?: Media) {
  const rows = await getDb()
    .select({ id: titleStates.externalId, media: titleStates.media, savedAt: titleStates.updatedAt })
    .from(titleStates)
    .where(and(eq(titleStates.userId, userId), eq(titleStates.saved, true), media ? eq(titleStates.media, media) : undefined))
    .orderBy(desc(titleStates.updatedAt))
    .limit(limit);
  return rows.map((r) => ({ id: Number(r.id), media: r.media as Media, savedAt: r.savedAt }));
}

/** How many titles of each kind are saved, all of them, not only the ones a page shows. */
export async function savedCounts(userId: string): Promise<Record<Media, number>> {
  const rows = await getDb()
    .select({ media: titleStates.media, n: sql<number>`count(*)` })
    .from(titleStates)
    .where(and(eq(titleStates.userId, userId), eq(titleStates.saved, true)))
    .groupBy(titleStates.media);
  const counts: Record<Media, number> = { movie: 0, series: 0, book: 0 };
  for (const r of rows) counts[r.media as Media] = Number(r.n);
  return counts;
}

/**
 * Everything you've watched or read, newest first: Seen it / Read it swipes,
 * titles marked seen from Saved, finished picks and "I've read it", with your
 * rating. Picks are in here too once you've watched them.
 */
export async function seenTitles(userId: string, limit = LIST_PAGE) {
  const rows = await getDb()
    .select({ id: titleStates.externalId, media: titleStates.media, rating: titleStates.rating, at: titleStates.updatedAt })
    .from(titleStates)
    .where(and(eq(titleStates.userId, userId), eq(titleStates.seen, true)))
    .orderBy(desc(titleStates.updatedAt))
    .limit(limit);
  return rows.map((r) => ({ id: Number(r.id), media: r.media as Media, rating: r.rating, at: r.at }));
}

export async function seenCount(userId: string): Promise<number> {
  const [row] = await getDb()
    .select({ n: sql<number>`count(*)` })
    .from(titleStates)
    .where(and(eq(titleStates.userId, userId), eq(titleStates.seen, true)));
  return Number(row?.n ?? 0);
}

/** How many picks you've made in all. */
export async function pickCount(userId: string): Promise<number> {
  const [row] = await getDb()
    .select({ n: sql<number>`count(*)` })
    .from(pickSessions)
    .where(and(eq(pickSessions.userId, userId), eq(pickSessions.status, "picked")));
  return Number(row?.n ?? 0);
}

/** Past picks, newest first, with the mood, the reason, and what you made of it. */
export async function pickHistory(userId: string, limit = LIST_PAGE) {
  const db = getDb();
  const sessions = await db
    .select({
      sessionId: pickSessions.id,
      media: pickSessions.media,
      pick: pickSessions.pick,
      mood: pickSessions.mood,
      why: pickSessions.why,
      pickedAt: pickSessions.completedAt,
      followUp: pickSessions.followUp,
    })
    .from(pickSessions)
    .where(
      and(
        eq(pickSessions.userId, userId),
        inArray(pickSessions.media, ["movie", "series", "book"]),
        eq(pickSessions.status, "picked"),
      ),
    )
    .orderBy(desc(pickSessions.completedAt))
    .limit(limit);

  const ids = [...new Set(sessions.flatMap((s) => (s.pick ? [s.pick.externalId] : [])))];
  const states = ids.length
    ? await db
        .select({
          id: titleStates.externalId,
          media: titleStates.media,
          seen: titleStates.seen,
          disliked: titleStates.disliked,
          rating: titleStates.rating,
          watchingSince: titleStates.watchingSince,
        })
        .from(titleStates)
        .where(and(eq(titleStates.userId, userId), inArray(titleStates.externalId, ids)))
    : [];
  const stateOf = new Map(states.map((s) => [`${s.media}:${s.id}`, s]));

  return sessions.flatMap((s) => {
    if (!s.pick) return [];
    const state = stateOf.get(`${s.media}:${s.pick.externalId}`);
    return [
      {
        sessionId: s.sessionId,
        media: s.media as Media,
        id: Number(s.pick.externalId),
        mood: s.mood,
        why: s.why,
        pickedAt: s.pickedAt,
        followUp: s.followUp as FollowUpAnswer | null,
        seen: state?.seen ?? false,
        dropped: (state?.disliked ?? false) && state?.watchingSince == null,
        watching: state?.watchingSince != null,
        rating: state?.rating ?? null,
      },
    ];
  });
}

/* ------------------------------------------------------------ preferences */

export const DEFAULT_PROVIDERS = [8, 119, 350, 2336];

/** Your streaming services as TMDb provider ids. */
export async function providersFor(userId: string): Promise<number[]> {
  const row = await getDb().query.preferences.findFirst({ where: eq(preferences.userId, userId) });
  return row?.providers ?? DEFAULT_PROVIDERS;
}

export async function saveProviders(userId: string, providers: number[]) {
  await getDb()
    .insert(preferences)
    .values({ userId, providers, updatedAt: new Date() })
    .onConflictDoUpdate({ target: preferences.userId, set: { providers, updatedAt: new Date() } });
}

/* ---------------------------------------------------------- pick from saved */

/** A run that skips the deck: the shortlist comes straight from your saved list. */
export async function createSavedSession(
  userId: string,
  media: Media,
  taps: { mood: string; energy: number; time: number },
  ids: number[],
) {
  const entries = ids.map((id) => ({ source: sourceOf(media), externalId: String(id) }));
  const [row] = await getDb()
    .insert(pickSessions)
    .values({ userId, media, origin: "saved", status: "finale", ...taps, deck: entries, shortlist: entries })
    .returning({ id: pickSessions.id });
  return row.id;
}

/* ------------------------------------------------- did you watch it? (films) */

/** How long after a film pick before asking whether you watched it. */
export const FOLLOW_UP_AFTER_HOURS = 3;

export type FollowUpAnswer = "watched" | "later" | "skipped";

/** The latest film pick you haven't told us about yet, if it's old enough to ask. */
export async function pendingFollowUp(userId: string) {
  const db = getDb();
  const [session] = await db
    .select({ id: pickSessions.id, pick: pickSessions.pick, pickedAt: pickSessions.completedAt })
    .from(pickSessions)
    .where(
      and(
        eq(pickSessions.userId, userId),
        eq(pickSessions.media, "movie"),
        eq(pickSessions.status, "picked"),
        isNull(pickSessions.followUp),
        lt(pickSessions.completedAt, sql`now() - make_interval(hours => ${FOLLOW_UP_AFTER_HOURS})`),
      ),
    )
    .orderBy(desc(pickSessions.completedAt))
    .limit(1);
  if (!session?.pick) return null;
  const state = await db.query.titleStates.findFirst({ where: titleKey(userId, "movie", session.pick.externalId) });
  // Already marked watched some other way (History, a rating): nothing to ask.
  if (state?.seen) return null;
  return { sessionId: session.id, movieId: Number(session.pick.externalId) };
}

/**
 * Records your answer. Watched: seen (and rated, if you gave stars). Not yet:
 * back on the saved list. Skipped it: just stop asking.
 */
export async function answerFollowUp(userId: string, sessionId: string, answer: FollowUpAnswer, stars: number | null) {
  const session = await ownedSession(userId, sessionId);
  if (!session.pick) throw new Error("That run has no pick.");
  const movieId = Number(session.pick.externalId);
  if (answer === "watched") {
    await updateTitleState(userId, "movie", movieId, "seen", { seen: true, ...(stars ? { rating: stars * 2 } : {}) });
  } else if (answer === "later") {
    await updateTitleState(userId, "movie", movieId, null, { saved: true });
  }
  await getDb()
    .update(pickSessions)
    .set({ followUp: answer, followedUpAt: new Date() })
    .where(eq(pickSessions.id, sessionId));
}

/* ------------------------------------------ watching (series), reading (books) */

/** Days between "still watching?" / "still reading?" questions for each title. */
export const CHECK_IN_EVERY_DAYS: Record<"series" | "book", number> = { series: 3, book: 7 };

/** Series on your Watching list, or books on your Reading list, most recently started first. */
export async function inProgress(userId: string, media: "series" | "book") {
  const rows = await getDb()
    .select({ id: titleStates.externalId, since: titleStates.watchingSince, checkedInAt: titleStates.checkedInAt })
    .from(titleStates)
    .where(
      and(
        eq(titleStates.userId, userId),
        eq(titleStates.media, media),
        eq(titleStates.source, sourceOf(media)),
        isNotNull(titleStates.watchingSince),
      ),
    )
    .orderBy(desc(titleStates.watchingSince));
  return rows.map((r) => ({ id: Number(r.id), since: r.since!, checkedInAt: r.checkedInAt }));
}

/** The title you've gone longest without being asked about, once enough days have passed. */
export async function pendingCheckIn(userId: string, media: "series" | "book") {
  const [row] = await getDb()
    .select({ id: titleStates.externalId })
    .from(titleStates)
    .where(
      and(
        eq(titleStates.userId, userId),
        eq(titleStates.media, media),
        eq(titleStates.source, sourceOf(media)),
        isNotNull(titleStates.watchingSince),
        lt(
          sql`coalesce(${titleStates.checkedInAt}, ${titleStates.watchingSince})`,
          sql`now() - make_interval(days => ${CHECK_IN_EVERY_DAYS[media]})`,
        ),
      ),
    )
    .orderBy(sql`coalesce(${titleStates.checkedInAt}, ${titleStates.watchingSince})`)
    .limit(1);
  return row ? { id: Number(row.id) } : null;
}

export type CheckInAnswer = "watching" | "finished" | "dropped";

/**
 * Still going: ask again later. Finished: seen (read), rated if you gave stars,
 * off the list. Dropped (or "gave up"): off the list, and it counts like "not for me".
 */
export async function checkIn(
  userId: string,
  media: "series" | "book",
  id: number,
  answer: CheckInAnswer,
  stars: number | null,
) {
  const now = new Date();
  if (answer === "watching") {
    await updateTitleState(userId, media, id, null, { checkedInAt: now });
  } else if (answer === "finished") {
    await updateTitleState(userId, media, id, "finished", {
      seen: true,
      watchingSince: null,
      checkedInAt: now,
      ...(stars ? { rating: stars * 2 } : {}),
    });
  } else {
    await updateTitleState(userId, media, id, "dropped", { disliked: true, watchingSince: null, checkedInAt: now });
  }
}

/** Your state for a list of titles (seen, saved, rating, in progress), for a person's page. */
export async function statesFor(userId: string, media: Media, ids: number[]) {
  if (!ids.length) return new Map<number, { seen: boolean; saved: boolean; rating: number | null; inProgress: boolean; disliked: boolean }>();
  const rows = await getDb()
    .select({
      id: titleStates.externalId,
      seen: titleStates.seen,
      saved: titleStates.saved,
      rating: titleStates.rating,
      watchingSince: titleStates.watchingSince,
      disliked: titleStates.disliked,
    })
    .from(titleStates)
    .where(
      and(
        eq(titleStates.userId, userId),
        eq(titleStates.media, media),
        eq(titleStates.source, sourceOf(media)),
        inArray(titleStates.externalId, ids.map(String)),
      ),
    );
  return new Map(
    rows.map((r) => [
      Number(r.id),
      { seen: r.seen, saved: r.saved, rating: r.rating, inProgress: r.watchingSince != null, disliked: r.disliked },
    ]),
  );
}

/** Titles you've loved: saved, picked, or rated four stars and up. Most recent first. */
export async function lovedTitles(userId: string, limit = 40) {
  const rows = await getDb()
    .select({ id: titleStates.externalId, media: titleStates.media })
    .from(titleStates)
    .where(
      and(
        eq(titleStates.userId, userId),
        or(eq(titleStates.saved, true), isNotNull(titleStates.pickedAt), gt(titleStates.rating, 7)),
      ),
    )
    .orderBy(desc(titleStates.updatedAt))
    .limit(limit);
  return rows.map((r) => ({ id: Number(r.id), media: r.media as Media }));
}

/* ----------------------------------------------------------------- resume */

/** An unfinished deck is offered for resuming for this long after it was dealt. */
export const RESUME_WITHIN_HOURS = 24;

/**
 * Your latest unfinished deck of this kind from the last day, and how far you
 * got: the swipes saved against it, in deck order (an undone swipe is gone
 * from the log, so the card counts as not swiped yet).
 */
export async function resumableDeck(userId: string, media: Media) {
  const db = getDb();
  const [session] = await db
    .select()
    .from(pickSessions)
    .where(
      and(
        eq(pickSessions.userId, userId),
        eq(pickSessions.media, media),
        eq(pickSessions.status, "dealing"),
        eq(pickSessions.origin, "deck"),
        gt(pickSessions.createdAt, sql`now() - make_interval(hours => ${RESUME_WITHIN_HOURS})`),
      ),
    )
    .orderBy(desc(pickSessions.createdAt))
    .limit(1);
  if (!session || session.deck.length === 0) return null;
  const logged = await db
    .select({ id: titleActions.externalId, action: titleActions.action })
    .from(titleActions)
    .where(and(eq(titleActions.pickSessionId, session.id), inArray(titleActions.action, SWIPES)))
    .orderBy(titleActions.createdAt);
  const last = new Map(logged.map((a) => [a.id, a.action as SwipeAction]));
  const actions: SwipeAction[] = [];
  for (const entry of session.deck) {
    const action = last.get(entry.externalId);
    if (!action) break;
    actions.push(action);
  }
  return {
    sessionId: session.id,
    taps: { mood: session.mood, energy: session.energy, time: session.time },
    ids: session.deck.map((e) => Number(e.externalId)),
    actions,
    createdAt: session.createdAt,
  };
}

/** "Start again": the unfinished deck won't be offered again. */
export async function abandonDeck(userId: string, sessionId: string) {
  await getDb()
    .update(pickSessions)
    .set({ status: "abandoned" })
    .where(and(eq(pickSessions.id, sessionId), eq(pickSessions.userId, userId), eq(pickSessions.status, "dealing")));
}
