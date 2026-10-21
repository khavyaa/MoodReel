import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { attachDatabasePool } from "@vercel/functions";
import * as schema from "./schema";

/*
 * One Postgres driver everywhere: Docker locally, Neon in production, a
 * throwaway container in CI. Neon's pooled connection string works over plain
 * TCP from Vercel's Node runtime, so nothing here is Neon-specific and the app
 * can move to a self-hosted Postgres without code changes.
 *
 * The pool is created lazily (not at import) so `next build` can import route
 * modules without a database. No Proxy wrapper: Better Auth inspects the adapter
 * object and a Proxy breaks it silently.
 */

export type Database = NodePgDatabase<typeof schema>;

let pool: Pool | null = null;
let db: Database | null = null;

export function getDb(): Database {
  if (db) return db;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Locally: `docker compose up -d` and use the URL in .env.example. On Vercel: connect the Neon integration.",
    );
  }
  pool = new Pool({
    connectionString: explicitSsl(url),
    // Serverless functions are short-lived; keep each instance's footprint small.
    max: process.env.VERCEL ? 3 : 10,
    idleTimeoutMillis: 10_000,
    // Neon's first query after idle has to wake the compute; give it room.
    connectionTimeoutMillis: 15_000,
  });
  // Vercel freezes an instance between requests with its connections still open, and
  // Neon closes them meanwhile. This keeps the instance alive just long enough for idle
  // connections to be closed properly, so a later request doesn't pick up a dead one.
  attachDatabasePool(pool);
  // A connection that dies while idle mustn't take the process down; the pool drops it.
  pool.on("error", () => {});
  retryOnceOnDroppedConnection(pool);
  db = drizzle(pool, { schema });
  return db;
}

/**
 * Neon's URL says `sslmode=require`, which today's driver already treats as
 * verify-full and warns that the next major version will weaken. Say verify-full
 * outright: same behaviour now, and no surprise later.
 */
export function explicitSsl(url: string): string {
  return url.replace(/([?&])sslmode=(?:prefer|require|verify-ca)(?=&|$)/, "$1sslmode=verify-full");
}

/** A dropped or timed-out connection, as opposed to a bad query: worth one more try. */
export function isDroppedConnection(error: unknown): boolean {
  const message = error instanceof Error ? `${error.message} ${error.cause instanceof Error ? error.cause.message : ""}` : "";
  return /Connection terminated|timeout exceeded when trying to connect|ECONNRESET|connection timeout/i.test(message);
}

/** Reads and writes outside a transaction go through pool.query: retry those once on a fresh connection. */
function retryOnceOnDroppedConnection(target: Pool) {
  const query = target.query.bind(target) as (...args: unknown[]) => Promise<unknown>;
  (target as unknown as { query: (...args: unknown[]) => Promise<unknown> }).query = async (...args: unknown[]) => {
    try {
      return await query(...args);
    } catch (error) {
      if (!isDroppedConnection(error)) throw error;
      return query(...args);
    }
  };
}

/** For tests and scripts that need to release the connection. */
export async function closeDb() {
  await pool?.end();
  pool = null;
  db = null;
}
