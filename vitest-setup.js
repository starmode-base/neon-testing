const isVitest = process.env.VITEST;

if (isVitest) {
  if (process.env.DATABASE_URL) {
    console.warn(
      "[neon-testing] Clearing existing DATABASE_URL in test environment",
    );
  }

  delete process.env.DATABASE_URL;
}
