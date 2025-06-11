import { defineConfig } from "vitest/config";
import dotenv from "dotenv";
import fs from "node:fs";

const env = dotenv.parse(fs.readFileSync(".env", "utf8"));

export default defineConfig({
  test: {
    env: {
      NEON_API_KEY: env.NEON_API_KEY,
      NEON_PROJECT_ID: env.NEON_PROJECT_ID,
    },
  },
});
