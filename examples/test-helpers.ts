import { makeNeonTestDatabase } from "..";

/**
 * A Neon test database setup/teardown function for Vitest test suites
 *
 * This is created by the makeNeonTestDatabase factory with our project's
 * specific configuration. When called in a test file, it will:
 *
 * 1. Create a new Neon database branch before any tests run
 * 2. Set up the DATABASE_URL environment variable
 * 3. Clean up the Neon branch after all tests complete
 *
 * Usage:
 * ```ts
 * withNeonTestDatabase();
 *
 * test("my test", async () => {
 *   // Your test code here
 * });
 * ```
 */
export const withNeonTestDatabase = makeNeonTestDatabase({
  apiKey: process.env.NEON_API_KEY!,
  projectId: process.env.NEON_PROJECT_ID!,
});
