const isVitest = process.env.VITEST;
const isDebug = process.env.NEON_TESTING_DEBUG === "true";

if (isVitest) {
  if (process.env.DATABASE_URL && isDebug) {
    console.debug(
      "[neon-testing] Clearing existing DATABASE_URL in test environment",
    );
  }

  delete process.env.DATABASE_URL;
}
