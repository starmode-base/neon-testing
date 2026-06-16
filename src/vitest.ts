import { beforeAll, afterAll } from "vitest";
import { makeNeonTestingCore } from "./core";
import type { MakeNeonTestingOptions } from "./core";

export type { MakeNeonTestingOptions, NeonTestingOptions } from "./core";

/**
 * Create a Neon test-branch factory wired to Vitest's lifecycle hooks.
 */
export function makeNeonTesting(options: MakeNeonTestingOptions) {
  return makeNeonTestingCore({ ...options, hooks: { beforeAll, afterAll } });
}
