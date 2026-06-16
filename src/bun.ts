/// <reference types="bun" />
import { beforeAll, afterAll } from "bun:test";
import { makeNeonTestingCore } from "./core";
import type { MakeNeonTestingOptions } from "./core";

export type { MakeNeonTestingOptions, NeonTestingOptions } from "./core";

/**
 * Create a Neon test-branch factory wired to Bun's lifecycle hooks.
 */
export function makeNeonTesting(options: MakeNeonTestingOptions) {
  return makeNeonTestingCore({ ...options, hooks: { beforeAll, afterAll } });
}
