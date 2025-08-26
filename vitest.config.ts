import { defineConfig } from "vitest/config";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import tsconfigPaths from "vite-tsconfig-paths";

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
  plugins: [tsconfigPaths()],
});
