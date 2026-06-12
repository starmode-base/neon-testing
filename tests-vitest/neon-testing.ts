// Per-runner harness: re-exports the runner's test primitives and the configured
// Neon factory, so the test files in this folder stay byte-identical to their
// tests-bun counterparts. Only this file differs between the two folders.
export {
  test,
  expect,
  describe,
  beforeAll,
  beforeEach,
  afterAll,
  afterEach,
} from "vitest";
import { makeNeonTesting } from "neon-testing/vitest";

export const neonTesting = makeNeonTesting({
  apiKey: process.env.NEON_API_KEY!,
  projectId: process.env.NEON_PROJECT_ID!,
});
