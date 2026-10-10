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

export type Media = "movie" | "series";

/** A skip means "not tonight", not "never": it hides a title for this long. */
export const SKIP_COOLDOWN_DAYS = 60;

function titleKey(userId: string, media: Media, id: number | string) {
  return and(
    eq(titleStates.userId, userId),
    eq(titleStates.media, media),
    eq(titleStates.source, "tmdb"),
    eq(titleStates.externalId, String(id)),
  );
}

function actionKey(userId: string, media: Media, id: number | string) {
  return and(
    eq(titleActions.userId, userId),
    eq(titleActions.media, media),
    eq(titleActions.source, "tmdb"),
    eq(titleActions.externalId, String(id)),
  );
}

/** TMDb ids you've already dealt with: seen, disliked, saved, picked, or skipped recently. */
export async function handledIds(userId: string, media: Media): Promise<Set<number>> {
  const rows = await getDb()
    .select({ id: titleStates.externalId })
    .from(titleStates)
    .where(
      and(
        eq(titleStates.userId, userId),
        eq(titleStates.media, media),
        eq(titleStates.source, "tmdb"),
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
  const [row] = await getDb()
    .insert(pickSessions)
    .values({
      userId,
      media,
      mood: taps.mood,
      energy: taps.energy,
      time: taps.time,
      status: ids.length ? "dealing" : "empty",
      deck: ids.map((id) => ({ source: "tmdb" as const, externalId: String(id) })),
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
type TitleRef = { id: number; language: string; genreIds: number[] };

function tagsFor(title: TitleRef) {
  return [...title.genreIds.map(String), `lang:${title.language}`];
}

async function logAction(
  userId: string,
  media: Media,
  sessionId: string,
  mood: string,
  title: TitleRef,
  action: ActionKind,
  state: Partial<typeof titleStates.$inferInsert>,
) {
  const db = getDb();
  const key = { userId, media, source: "tmdb" as const, externalId: String(title.id) };
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
    const entry = { source: "tmdb" as const, externalId: String(title.id) };
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

/** The pick moves from "saved" into history (a series onto your Watching list); the other saves stay saved. */
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
    ...(session.media === "series" ? { watchingSince: now, checkedInAt: null } : {}),
  });
  await getDb()
    .update(pickSessions)
    .set({
      status: "picked",
      pick: { source: "tmdb", externalId: String(title.id) },
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
        source: "tmdb",
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

/** Everything you swiped right on and haven't picked or removed, newest first. */
export async function savedTitles(userId: string, limit = 80) {
  const rows = await getDb()
    .select({ id: titleStates.externalId, media: titleStates.media, savedAt: titleStates.updatedAt })
    .from(titleStates)
    .where(and(eq(titleStates.userId, userId), eq(titleStates.source, "tmdb"), eq(titleStates.saved, true)))
    .orderBy(desc(titleStates.updatedAt))
    .limit(limit);
  return rows.flatMap((r) =>
    r.media === "book" ? [] : [{ id: Number(r.id), media: r.media as Media, savedAt: r.savedAt }],
  );
}

/** Past picks, newest first, with the mood, the reason, and what you made of it. */
export async function pickHistory(userId: string, limit = 50) {
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
        inArray(pickSessions.media, ["movie", "series"]),
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
        .where(
          and(eq(titleStates.userId, userId), eq(titleStates.source, "tmdb"), inArray(titleStates.externalId, ids)),
        )
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
  const entries = ids.map((id) => ({ source: "tmdb" as const, externalId: String(id) }));
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

/* ------------------------------------------------------ watching (series) */

/** Days between "still watching?" questions for each show. */
export const CHECK_IN_EVERY_DAYS = 3;

/** Series on your Watching list, most recently started first. */
export async function watchingSeries(userId: string) {
  const rows = await getDb()
    .select({ id: titleStates.externalId, since: titleStates.watchingSince, checkedInAt: titleStates.checkedInAt })
    .from(titleStates)
    .where(
      and(
        eq(titleStates.userId, userId),
        eq(titleStates.media, "series"),
        eq(titleStates.source, "tmdb"),
        isNotNull(titleStates.watchingSince),
      ),
    )
    .orderBy(desc(titleStates.watchingSince));
  return rows.map((r) => ({ id: Number(r.id), since: r.since!, checkedInAt: r.checkedInAt }));
}

/** The show you've gone longest without being asked about, once it's been a few days. */
export async function pendingCheckIn(userId: string) {
  const [row] = await getDb()
    .select({ id: titleStates.externalId })
    .from(titleStates)
    .where(
      and(
        eq(titleStates.userId, userId),
        eq(titleStates.media, "series"),
        eq(titleStates.source, "tmdb"),
        isNotNull(titleStates.watchingSince),
        lt(
          sql`coalesce(${titleStates.checkedInAt}, ${titleStates.watchingSince})`,
          sql`now() - make_interval(days => ${CHECK_IN_EVERY_DAYS})`,
        ),
      ),
    )
    .orderBy(sql`coalesce(${titleStates.checkedInAt}, ${titleStates.watchingSince})`)
    .limit(1);
  return row ? { id: Number(row.id) } : null;
}

export type CheckInAnswer = "watching" | "finished" | "dropped";

/**
 * Still watching: ask again in a few days. Finished: seen, rated if you gave
 * stars, off the list. Dropped: off the list, and it counts like "not for me".
 */
export async function checkInSeries(userId: string, id: number, answer: CheckInAnswer, stars: number | null) {
  const now = new Date();
  if (answer === "watching") {
    await updateTitleState(userId, "series", id, null, { checkedInAt: now });
  } else if (answer === "finished") {
    await updateTitleState(userId, "series", id, "finished", {
      seen: true,
      watchingSince: null,
      checkedInAt: now,
      ...(stars ? { rating: stars * 2 } : {}),
    });
  } else {
    await updateTitleState(userId, "series", id, "dropped", { disliked: true, watchingSince: null, checkedInAt: now });
  }
}
