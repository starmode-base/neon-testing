// Captures DATABASE_URL as it stands after all preloads ran, before any test
// file executes. Test files sharing this process legitimately set and clear
// DATABASE_URL in their lifecycle hooks, so the preload test must assert on
// this snapshot, not on process.env at test time.
globalThis.__neonTestingDatabaseUrlAfterPreload = process.env.DATABASE_URL;

declare global {
  var __neonTestingDatabaseUrlAfterPreload: string | undefined;
}
