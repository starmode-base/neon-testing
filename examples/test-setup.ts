import { makeNeonTesting } from "..";

export const withNeonTestBranch = makeNeonTesting({
  apiKey: process.env.NEON_API_KEY!,
  projectId: process.env.NEON_PROJECT_ID!,
});
