import { neonTesting as neonTestingVite } from "./vite-plugin.js";
export { lazySingleton } from "./singleton.js";
export { createBarrier } from "./barrier.js";

/**
 * @deprecated Import the Vite plugin from "neon-testing/vite" instead. This
 * export will be removed in the next major version.
 */
export const neonTesting = neonTestingVite;
