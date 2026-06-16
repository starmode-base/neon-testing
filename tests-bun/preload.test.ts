import { expect, test } from "./neon-testing";
import { POISON_DATABASE_URL } from "./poison-database-url";

// This file deliberately never calls neonTesting(). The poison preload set
// DATABASE_URL before the runner started; neon-testing/setup must have cleared
// it, so a file that forgets neonTesting() cannot reach a pre-configured
// database. Asserts on the preload-time snapshot (not process.env) because
// other test files in the same process set and clear DATABASE_URL in their
// lifecycle hooks.

test("preload clears any pre-existing DATABASE_URL", () => {
  expect(globalThis.__neonTestingPoisonSet).toBe(true);
  expect(globalThis.__neonTestingDatabaseUrlAfterPreload).not.toBe(
    POISON_DATABASE_URL,
  );
});
