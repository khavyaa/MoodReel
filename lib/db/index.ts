import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
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
    connectionString: url,
    // Serverless functions are short-lived; keep each instance's footprint small.
    max: process.env.VERCEL ? 3 : 10,
    idleTimeoutMillis: 10_000,
    // Neon's first query after idle has to wake the compute; give it room.
    connectionTimeoutMillis: 15_000,
  });
  db = drizzle(pool, { schema });
  return db;
}

/** For tests and scripts that need to release the connection. */
export async function closeDb() {
  await pool?.end();
  pool = null;
  db = null;
}
