import { defineConfig } from "vitest/config";
import dotenv from "dotenv";

dotenv.config();

export default defineConfig({
  test: {
    setupFiles: ["neon-testing/setup"],
    testTimeout: 15_000,
    hookTimeout: 30_000,
  },
});
