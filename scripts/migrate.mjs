// Applies drizzle/ migrations to DATABASE_URL.
//   node scripts/migrate.mjs             always (local, CI)
//   node scripts/migrate.mjs --if-vercel only inside a Vercel *production* build; a no-op
//                                        elsewhere. A laptop build never touches a database, and
//                                        neither does a pull request's preview build: a preview runs
//                                        on its own Neon branch (a copy of production), and a PR's
//                                        migration should reach production only once it's merged.
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

if (process.argv.includes("--if-vercel") && process.env.VERCEL_ENV !== "production") {
  console.log(`migrate: not a production build (${process.env.VERCEL_ENV ?? "local"}), skipping`);
  process.exit(0);
}
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("migrate: DATABASE_URL is not set");
  process.exit(1);
}
const pool = new pg.Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 20_000 });
try {
  await migrate(drizzle(pool), { migrationsFolder: "drizzle" });
  console.log("migrate: up to date");
} finally {
  await pool.end();
}
