// Applies drizzle/ migrations to DATABASE_URL.
//   node scripts/migrate.mjs             always (local, CI)
//   node scripts/migrate.mjs --if-vercel only inside a Vercel build; a no-op elsewhere,
//                                        so `npm run build` on a laptop never touches a database.
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

if (process.argv.includes("--if-vercel") && !process.env.VERCEL) {
  console.log("migrate: not a Vercel build, skipping");
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
