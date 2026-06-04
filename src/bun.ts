/// <reference types="bun" />
import { beforeAll, afterAll } from "bun:test";
import { makeNeonTesting as makeNeonTestingCore } from "./index";
import type { NeonTestingConfig } from "./index";

export type { NeonTestingConfig, NeonTestingOverrides } from "./index";

/**
 * Create a Neon test branch factory wired to Bun's lifecycle hooks.
 */
export function makeNeonTesting(config: NeonTestingConfig) {
  return makeNeonTestingCore({ ...config, hooks: { beforeAll, afterAll } });
}
