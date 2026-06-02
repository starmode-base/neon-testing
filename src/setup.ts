// Clears DATABASE_URL before test modules import, so a test file that forgot
// to enable a Neon branch fails loudly instead of silently hitting a real
// database. Only ever loaded as a test-runner preload (Vitest `setupFiles` /
// Bun `bunfig` `preload`).
if (process.env.DATABASE_URL && process.env.NEON_TESTING_DEBUG === "true") {
  console.debug("[neon-testing] Clearing existing DATABASE_URL");
}

delete process.env.DATABASE_URL;
