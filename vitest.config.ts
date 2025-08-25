import { defineConfig } from "vitest/config";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

// This is a precaution to ensure that any production database URL is not used
// in tests. The DATABASE_URL environment variable will be dynamically set by
// `makeNeonTesting()()` in the test environment.
delete process.env.DATABASE_URL;

export default defineConfig({
  test: {
    testTimeout: 30000,
  },
  // resolve: {
  //   alias: {
  //     "neon-testing": path.resolve(__dirname, "index.ts"),
  //   },
  // },
});
