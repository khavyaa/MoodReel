import { defineConfig } from "drizzle-kit";

// drizzle-kit does not read .env.local; npm scripts load it with dotenv-cli.
export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  strict: true,
  verbose: true,
});
