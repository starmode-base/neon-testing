// Simulates a developer machine where DATABASE_URL is already set (e.g. via
// .env or the shell) - runs before neon-testing/setup, which must clear it so
// tests can never reach a pre-configured database. The marker lets the preload
// test prove the poison actually ran (guards against a vacuous assertion).
process.env.DATABASE_URL = "postgresql://poison:poison@poison.invalid/poison";
globalThis.__neonTestingPoisonSet = true;

declare global {
  var __neonTestingPoisonSet: boolean | undefined;
}
