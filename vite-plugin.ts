import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

/**
 * Neon Testing Vite plugin
 */
export function neonTesting(
  options: {
    /**
     * Enable debug logging.
     *
     * @default false
     */
    debug?: boolean;
  } = {},
): Plugin {
  return {
    name: "neon-testing-plugin",
    // Run as late as possible to reduce the risk of other plugins restoring
    // DATABASE_URL after we clear it
    enforce: "post",
    config(user) {
      const setupPath = fileURLToPath(
        new URL("./vitest-setup.js", import.meta.url),
      );

      return {
        test: {
          // Register the vitest-setup.js file to run after other setup files
          setupFiles: Array.from(
            new Set([...(user.test?.setupFiles ?? []), setupPath]),
          ),
          env: {
            ...user.test?.env,
            NEON_TESTING_DEBUG: options.debug ? "true" : "false",
          },
        },
      };
    },
  };
}
