import { neonTesting as neonTestingVite } from "./vite-plugin";
export { lazySingleton } from "./singleton";
export { createBarrier } from "./barrier";

/**
 * @deprecated Import the Vite plugin from "neon-testing/vite" instead. This
 * export will be removed in the next major version.
 */
export const neonTesting = neonTestingVite;
