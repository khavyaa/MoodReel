import { defineConfig, devices } from "@playwright/test";

/*
 * End-to-end tests against a production build on its own port and its own
 * database, with a known setup token. Passkeys use Chromium's virtual
 * authenticator (see tests/e2e/passkey.ts), so iPhone-sized runs use Chromium
 * with an iPhone viewport rather than WebKit.
 */

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;
export const E2E_SETUP_TOKEN = "e2e-setup-token-0123456789";

const MOCK_TMDB_PORT = 3199;

const env = {
  // Decks come from a fixed fake TMDb (tests/e2e/mock-tmdb.mjs), never the real one.
  TMDB_BASE_URL: `http://localhost:${MOCK_TMDB_PORT}/3`,
  TMDB_ACCESS_TOKEN: "e2e-fake-token",
  DATABASE_URL:
    process.env.DATABASE_URL_TEST ?? "postgres://moodreel:moodreel@localhost:5433/moodreel_test",
  BETTER_AUTH_SECRET: "e2e-secret-with-enough-length-0123456789abcdef",
  OWNER_SETUP_TOKEN: E2E_SETUP_TOKEN,
  APP_URL: BASE_URL,
};

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1, // one owner, one database: runs must not overlap
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: { baseURL: BASE_URL, trace: "retain-on-failure" },
  projects: [
    { name: "laptop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    {
      name: "iphone",
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    },
  ],
  webServer: [
    {
      command: "node tests/e2e/mock-tmdb.mjs",
      url: `http://localhost:${MOCK_TMDB_PORT}/3/movie/1000`,
      env: { MOCK_TMDB_PORT: String(MOCK_TMDB_PORT) },
      reuseExistingServer: false,
    },
    {
      // Clear Next's fetch cache first: it keeps TMDb responses for hours, so a
      // changed fake TMDb would otherwise be ignored between local runs.
      command: `node -e "require('fs').rmSync('.next/cache/fetch-cache',{recursive:true,force:true})" && node scripts/migrate.mjs && npx next build && npx next start --port ${PORT}`,
      url: `${BASE_URL}/sign-in`,
      env,
      timeout: 240_000,
      reuseExistingServer: false,
    },
  ],
});
