// test-setup.ts
import { makeNeonTesting } from "neon-testing";

// Export a configured lifecycle function to use in test files
export const withNeonTestBranch = makeNeonTesting({
  apiKey: process.env.NEON_API_KEY!,
  projectId: process.env.NEON_PROJECT_ID!,
});
