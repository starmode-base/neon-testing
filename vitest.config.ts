import { defineConfig } from "vitest/config";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

// This is a precaution to ensure that any production database URL is not used
// in tests. The DATABASE_URL environment variable will be dynamically set by
// `makeNeonTesting()()` in the test environment.
delete process.env.DATABASE_URL;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      // This alias allows us to import "neon-testing" in our test files, and
      // have it resolve to the local "index.ts" file in this project. This
      // ensures that tests always use the local source code, not a published
      // package. This is only for this library, not for the project using it.
      "neon-testing": path.resolve(__dirname, "index.ts"),
      "neon-testing/utils": path.resolve(__dirname, "singleton.ts"),
    },
  },
});
