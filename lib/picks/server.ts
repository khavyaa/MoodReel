import "server-only";
import { and, desc, eq, gt, isNotNull, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { pickSessions, titleActions, titleStates } from "@/lib/db/schema";
import { buildTasteProfile, type ActionKind } from "@/lib/taste/profile";
import type { TasteProfile } from "@/lib/taste/rules";

/*
 * Reads and writes for the pick flow. Every function takes the owner id from
 * the verified session (lib/session.ts) and scopes every query by it.
 */

/** A skip means "not tonight", not "never": it hides a film for this long. */
export const SKIP_COOLDOWN_DAYS = 60;

/** TMDb movie ids you've already dealt with: seen, disliked, saved, picked, or skipped recently. */
export async function handledMovieIds(userId: string): Promise<Set<number>> {
  const rows = await getDb()
    .select({ id: titleStates.externalId })
    .from(titleStates)
    .where(
      and(
        eq(titleStates.userId, userId),
        eq(titleStates.media, "movie"),
        eq(titleStates.source, "tmdb"),
        or(
          eq(titleStates.seen, true),
          eq(titleStates.disliked, true),
          eq(titleStates.saved, true),
          isNotNull(titleStates.pickedAt),
          and(
            eq(titleStates.skipped, true),
            gt(titleStates.updatedAt, sql`now() - make_interval(days => ${SKIP_COOLDOWN_DAYS})`),
          ),
        ),
      ),
    );
  return new Set(rows.map((r) => Number(r.id)));
}

export async function tasteFor(userId: string): Promise<TasteProfile> {
  const rows = await getDb()
    .select({ action: titleActions.action, tags: titleActions.tags })
    .from(titleActions)
    .where(eq(titleActions.userId, userId))
    .orderBy(desc(titleActions.createdAt))
    .limit(500);
  return buildTasteProfile(rows as { action: ActionKind; tags: string[] }[]);
}

export async function createMovieSession(
  userId: string,
  taps: { mood: string; energy: number; time: number },
  movieIds: number[],
) {
  const [row] = await getDb()
    .insert(pickSessions)
    .values({
      userId,
      media: "movie",
      mood: taps.mood,
      energy: taps.energy,
      time: taps.time,
      status: movieIds.length ? "dealing" : "empty",
      deck: movieIds.map((id) => ({ source: "tmdb" as const, externalId: String(id) })),
    })
    .returning({ id: pickSessions.id });
  return row.id;
}

async function ownedSession(userId: string, sessionId: string) {
  const session = await getDb().query.pickSessions.findFirst({
    where: and(eq(pickSessions.id, sessionId), eq(pickSessions.userId, userId)),
  });
  if (!session) throw new Error("That deck isn't yours, or it no longer exists.");
  return session;
}

export type SwipeAction = "saved" | "skipped" | "seen";
type TitleRef = { id: number; language: string; genreIds: number[] };

function tagsFor(title: TitleRef) {
  return [...title.genreIds.map(String), `lang:${title.language}`];
}

async function logAction(
  userId: string,
  sessionId: string,
  mood: string,
  title: TitleRef,
  action: ActionKind,
  state: Partial<typeof titleStates.$inferInsert>,
) {
  const db = getDb();
  const key = { userId, media: "movie" as const, source: "tmdb" as const, externalId: String(title.id) };
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
  const state =
    action === "saved" ? { saved: true, skipped: false } : action === "seen" ? { seen: true, saved: false } : { skipped: true };
  await logAction(userId, sessionId, session.mood, title, action, state);

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

export async function completePick(
  userId: string,
  sessionId: string,
  title: TitleRef,
  why: { text: string; source: "ai" | "rules" },
) {
  const session = await ownedSession(userId, sessionId);
  // The pick moves from "saved" into history; the other saves stay saved.
  await logAction(userId, sessionId, session.mood, title, "picked", { pickedAt: new Date(), saved: false });
  await getDb()
    .update(pickSessions)
    .set({
      status: "picked",
      pick: { source: "tmdb", externalId: String(title.id) },
      why: why.text,
      whySource: why.source,
      completedAt: new Date(),
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
