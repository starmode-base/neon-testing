import { defineConfig, configDefaults } from "vitest/config";
import dotenv from "dotenv";

dotenv.config();

export default defineConfig({
  test: {
    setupFiles: ["neon-testing/setup"],
    testTimeout: 15_000,
    hookTimeout: 30_000,
    exclude: [...configDefaults.exclude, "**/dist/**"],
    // Limit to concurrent test files to avoid Neon API rate limiting
    // maxConcurrency: 2,
  },
});
