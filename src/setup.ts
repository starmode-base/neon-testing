// Overwrites any existing DATABASE_URL with a sentinel so a test file that
// forgot to call `neonTesting()` can't reach the pre-configured database.
// Loaded as a test-runner preload (Vitest `setupFiles` / Bun `bunfig`
// `preload`).
//
// A sentinel string (rather than `delete`) keeps the value a string for
// consumers that type DATABASE_URL as required; connecting to it fails loudly.
if (process.env.DATABASE_URL && process.env.NEON_TESTING_DEBUG === "true") {
  console.debug("[neon-testing] Clearing existing DATABASE_URL");
}

process.env.DATABASE_URL =
  "neon-testing: DATABASE_URL cleared, call neonTesting()";
