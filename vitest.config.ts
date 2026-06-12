import { defineConfig, configDefaults } from "vitest/config";
import dotenv from "dotenv";

dotenv.config();

export default defineConfig({
  test: {
    // tests-bun/ is owned by `bun test` and imports from "bun:test", so keep it
    // out of Vitest's globs
    exclude: [...configDefaults.exclude, "tests-bun/**"],
    setupFiles: ["neon-testing/setup"],
    testTimeout: 15_000,
    hookTimeout: 30_000,
  },
});
