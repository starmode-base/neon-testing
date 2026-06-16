/// <reference types="bun" />
import { beforeAll, afterAll } from "bun:test";
import { makeNeonTestingCore } from "./core.js";
import type { MakeNeonTestingOptions } from "./core.js";

export type { MakeNeonTestingOptions, NeonTestingOptions } from "./core.js";

/**
 * Create a Neon test-branch factory wired to Bun's lifecycle hooks.
 */
export function makeNeonTesting(options: MakeNeonTestingOptions) {
  return makeNeonTestingCore({ ...options, hooks: { beforeAll, afterAll } });
}
