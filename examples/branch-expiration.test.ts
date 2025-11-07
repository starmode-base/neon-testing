import { describe, expect, test } from "vitest";
import { neonTesting } from "./test-setup";
import invariant from "tiny-invariant";

describe("Branch expiration with default settings", () => {
  const getBranch = neonTesting();

  test("sets default 10-minute expiration on created branch", async () => {
    const branch = getBranch();
    invariant(branch, "Branch not found");
    invariant(branch.expires_at, "Branch expires_at not set");

    // Verify the expires_at matches what Neon API returns
    // https://api-docs.neon.tech/reference/getprojectbranch
    const { data } = await neonTesting.api.getProjectBranch(
      branch.project_id,
      branch.id,
    );
    expect(data.branch?.expires_at).toBe(branch.expires_at);

    // Verify it's approximately 600 seconds (10 minutes) in the future
    const expiresAt = new Date(branch.expires_at).getTime();
    const createdAt = new Date(branch.created_at).getTime();
    const expectedExpiresAt = createdAt + 600 * 1000;

    // Allow 10 seconds of tolerance
    expect(expiresAt).toBeGreaterThan(createdAt);
    expect(expiresAt).toBeLessThan(expectedExpiresAt + 10000);
    expect(expiresAt).toBeGreaterThan(expectedExpiresAt - 10000);
  });
});

describe("Branch expiration with custom settings", () => {
  const getBranch = neonTesting({
    expiresIn: 1800,
  });

  test("sets custom 30-minute expiration on created branch", async () => {
    const branch = getBranch();
    invariant(branch, "Branch not found");
    invariant(branch.expires_at, "Branch expires_at not set");

    // Verify the expires_at matches what Neon API returns
    // https://api-docs.neon.tech/reference/getprojectbranch
    const { data } = await neonTesting.api.getProjectBranch(
      branch.project_id,
      branch.id,
    );
    expect(data.branch?.expires_at).toBe(branch.expires_at);

    // Verify it's approximately 1800 seconds (30 minutes) in the future
    const expiresAt = new Date(branch.expires_at).getTime();
    const createdAt = new Date(branch.created_at).getTime();
    const expectedExpiresAt = createdAt + 1800 * 1000;

    // Allow 10 seconds of tolerance
    expect(expiresAt).toBeGreaterThan(createdAt);
    expect(expiresAt).toBeLessThan(expectedExpiresAt + 10000);
    expect(expiresAt).toBeGreaterThan(expectedExpiresAt - 10000);
  });
});

describe("Branch expiration disabled", () => {
  const getBranch = neonTesting({
    expiresIn: null,
  });

  test("creates branch without expiration when disabled", async () => {
    const branch = getBranch();
    invariant(branch, "Branch not found");

    // Verify the expires_at matches what Neon API returns (both should be undefined)
    // https://api-docs.neon.tech/reference/getprojectbranch
    const { data } = await neonTesting.api.getProjectBranch(
      branch.project_id,
      branch.id,
    );
    expect(branch.expires_at).toBeUndefined();
    expect(data.branch?.expires_at).toBe(branch.expires_at);
  });
});
