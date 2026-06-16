import { CLEARED_DATABASE_URL } from "./lib/cleared-database-url";

// Overwrites any existing DATABASE_URL so a test file that forgot to call
// `neonTesting()` can't reach the pre-configured database. Loaded as a
// test-runner preload (Vitest `setupFiles` / Bun `bunfig` `preload`).
if (process.env.DATABASE_URL && process.env.NEON_TESTING_DEBUG === "true") {
  console.debug("[neon-testing] Overwriting existing DATABASE_URL");
}

process.env.DATABASE_URL = CLEARED_DATABASE_URL;
