import { describe, expect, test } from "vitest";
import { makeNeonTesting } from "neon-testing";

const projectId = process.env.NEON_PROJECT_ID!;

describe("expiresIn", () => {
  /**
   * Test options validation when setting the factory-level options
   */
  describe("factory-level (makeNeonTesting)", () => {
    test("non-integer throws", () => {
      expect(() => {
        makeNeonTesting({
          apiKey: process.env.NEON_API_KEY!,
          projectId,
          expiresIn: 600.5,
        });
      }).toThrow("expiresIn must be an integer");
    });

    test("zero throws", () => {
      expect(() => {
        makeNeonTesting({
          apiKey: process.env.NEON_API_KEY!,
          projectId,
          expiresIn: 0,
        });
      }).toThrow("expiresIn must be a positive integer");
    });

    test("negative throws", () => {
      expect(() => {
        makeNeonTesting({
          apiKey: process.env.NEON_API_KEY!,
          projectId,
          expiresIn: -10,
        });
      }).toThrow("expiresIn must be a positive integer");
    });

    test("> 30 days throws", () => {
      expect(() => {
        makeNeonTesting({
          apiKey: process.env.NEON_API_KEY!,
          projectId,
          expiresIn: 2592001,
        });
      }).toThrow("expiresIn must not exceed 30 days");
    });

    test("valid value does not throw", () => {
      expect(() => {
        makeNeonTesting({
          apiKey: process.env.NEON_API_KEY!,
          projectId,
          expiresIn: 600,
        });
      }).not.toThrow();
    });

    test("null does not throw", () => {
      expect(() => {
        makeNeonTesting({
          apiKey: process.env.NEON_API_KEY!,
          projectId,
          expiresIn: null,
        });
      }).not.toThrow();
    });
  });

  /**
   * Test options validation when overriding the factory-level options
   */
  describe("override-level (setup function)", () => {
    // Create a base neonTesting without expiresIn specified at factory level
    const baseTesting = makeNeonTesting({
      apiKey: process.env.NEON_API_KEY!,
      projectId,
    });

    test("non-integer in override throws", () => {
      expect(() => {
        baseTesting({ expiresIn: 600.5 });
      }).toThrow("expiresIn must be an integer");
    });

    test("zero in override throws", () => {
      expect(() => {
        baseTesting({ expiresIn: 0 });
      }).toThrow("expiresIn must be a positive integer");
    });

    test("negative in override throws", () => {
      expect(() => {
        baseTesting({ expiresIn: -10 });
      }).toThrow("expiresIn must be a positive integer");
    });

    test("> 30 days in override throws", () => {
      expect(() => {
        baseTesting({ expiresIn: 2592001 });
      }).toThrow("expiresIn must not exceed 30 days");
    });

    // Note: Valid override values (600, null) are tested in branch-expiration.test.ts
    // where describe blocks actually create branches. We can't test them here since
    // calling baseTesting() inside a test would register beforeAll() hooks which is
    // not allowed.
  });
});
