import "server-only";
import { auth } from "./auth";
import { getDb } from "./db";

/** The single MoodReel account, or null before /setup has been completed. */
export async function findOwner() {
  return (await getDb().query.user.findFirst({ columns: { id: true, name: true } })) ?? null;
}

export async function getOrCreateOwner() {
  const existing = await findOwner();
  if (existing) return existing;
  const ctx = await auth.$context;
  // The user-create hook in lib/auth.ts refuses this if an owner already exists,
  // so two setups racing each other still end with one account.
  const created = await ctx.internalAdapter.createUser(
    { name: "MoodReel", email: "owner@moodreel.invalid", emailVerified: true },
    { method: "owner-setup" },
  );
  return { id: created.id, name: created.name };
}
