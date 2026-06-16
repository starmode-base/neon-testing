// Removes any existing DATABASE_URL so a test file that forgot to call
// `neonTesting()` can't reach the pre-configured database. Loaded as a
// test-runner preload (Vitest `setupFiles` / Bun `bunfig` `preload`).
if (process.env.DATABASE_URL && process.env.NEON_TESTING_DEBUG === "true") {
  console.debug("[neon-testing] Clearing existing DATABASE_URL");
}

delete process.env.DATABASE_URL;
