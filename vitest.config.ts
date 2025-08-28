import { defineConfig } from "vitest/config";
import dotenv from "dotenv";
import tsconfigPaths from "vite-tsconfig-paths";
import { neonTesting } from "./utils";

dotenv.config();

export default defineConfig({
  test: {
    testTimeout: 10000,
  },
  plugins: [tsconfigPaths(), neonTesting()],
});
