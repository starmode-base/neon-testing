import { defineConfig, configDefaults } from "vitest/config";
import dotenv from "dotenv";

dotenv.config();

export default defineConfig({
  test: {
    // tests-bun/ is owned by `bun test` and imports from "bun:test", so keep it
    // out of Vitest's globs
    exclude: [...configDefaults.exclude, "tests-bun/**"],
    // poison simulates a pre-set DATABASE_URL, neon-testing/setup must clear
    // it, capture snapshots the result for the preload test (order matters)
    setupFiles: [
      "./tests-vitest/poison-database-url.ts",
      "neon-testing/setup",
      "./tests-vitest/capture-database-url.ts",
    ],
    testTimeout: 15_000,
    hookTimeout: 30_000,
  },
});
