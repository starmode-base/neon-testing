import { defineConfig, configDefaults } from "vitest/config";
import dotenv from "dotenv";
import tsconfigPaths from "vite-tsconfig-paths";
import { neonTesting } from "./vite-plugin";

dotenv.config();

export default defineConfig({
  test: {
    testTimeout: 10000,
    hookTimeout: 20000,
    exclude: [...configDefaults.exclude, "**/dist/**"],
    // Limit to concurrent test files to avoid Neon API rate limiting
    maxConcurrency: 2,
  },
  plugins: [tsconfigPaths(), neonTesting({ debug: false })],
});
