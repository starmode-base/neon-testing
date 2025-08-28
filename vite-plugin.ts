import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

export function neonTesting(): Plugin {
  return {
    name: "neon-testing-plugin",
    enforce: "pre",
    config(user) {
      const setupPath = fileURLToPath(
        new URL("./vitest-setup.ts", import.meta.url),
      );

      const setup = new Set([...(user.test?.setupFiles ?? []), setupPath]);

      return {
        test: {
          setupFiles: Array.from(setup),
        },
      };
    },
  };
}
