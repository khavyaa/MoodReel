import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const alias = {
  "@": fileURLToPath(new URL("./", import.meta.url)),
  // `server-only` throws outside a React Server Components build; stub it for tests.
  "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
};

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      { resolve: { alias }, test: { name: "unit", include: ["tests/unit/**/*.test.ts"], environment: "node" } },
      {
        resolve: { alias },
        // Needs Postgres: `docker compose up -d`, then `npm run test:db`.
        test: { name: "db", include: ["tests/db/**/*.test.ts"], environment: "node", fileParallelism: false },
      },
    ],
  },
});
