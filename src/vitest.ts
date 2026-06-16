import { beforeAll, afterAll } from "vitest";
import { makeNeonTestingCore } from "./core.js";
import type { MakeNeonTestingOptions } from "./core.js";

export type { MakeNeonTestingOptions, NeonTestingOptions } from "./core.js";

/**
 * Create a Neon test-branch factory wired to Vitest's lifecycle hooks.
 */
export function makeNeonTesting(options: MakeNeonTestingOptions) {
  return makeNeonTestingCore({ ...options, hooks: { beforeAll, afterAll } });
}
