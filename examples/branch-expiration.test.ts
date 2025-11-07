import { describe, expect, test } from "vitest";
import { createApiClient, EndpointType } from "@neondatabase/api-client";
import { neonTesting } from "./test-setup";
import invariant from "tiny-invariant";

const projectId = process.env.NEON_PROJECT_ID!;

describe("Branch expiration with default settings", () => {
  const getBranch = neonTesting();

  test("branch created with default expiration has expires_at set ~600s in future", async () => {
    const branch = getBranch();

    // Verify expires_at is set
    expect(branch?.expires_at).toBeDefined();

    // Verify it's approximately 600 seconds (10 minutes) in the future
    const expiresAt = new Date(branch?.expires_at!).getTime();
    const now = Date.now();
    const expectedExpiresAt = now + 600 * 1000;

    // Allow 10 seconds of tolerance for API call time
    expect(expiresAt).toBeGreaterThan(now);
    expect(expiresAt).toBeLessThan(expectedExpiresAt + 10000);
    expect(expiresAt).toBeGreaterThan(expectedExpiresAt - 10000);
  });
});

describe("Branch expiration with custom settings", () => {
  const getBranch = neonTesting({
    expiresIn: 1800,
  });

  test("branch created with custom expiresIn has correct expires_at", async () => {
    const branch = getBranch();
    invariant(branch, "Branch not found");

    // Verify expires_at is set
    expect(branch.expires_at).toBeDefined();

    // Verify it's approximately 1800 seconds (30 minutes) in the future
    const expiresAt = new Date(branch.expires_at!).getTime();
    const now = Date.now();
    const expectedExpiresAt = now + 1800 * 1000;

    // Allow 10 seconds of tolerance for API call time
    expect(expiresAt).toBeGreaterThan(now);
    expect(expiresAt).toBeLessThan(expectedExpiresAt + 10000);
    expect(expiresAt).toBeGreaterThan(expectedExpiresAt - 10000);
  });
});

describe("Branch expiration disabled", () => {
  const getBranch = neonTesting({
    expiresIn: null,
  });

  test("branch created with expiresIn: null has no expiration", async () => {
    const branch = getBranch();
    invariant(branch, "Branch not found");

    // Get the list of branches and find our test branch
    const { data } = await neonTesting.api.getProjectBranch(
      projectId,
      branch.id,
    );

    expect(data.branch).toBeDefined();

    // Verify expires_at is not set
    expect(data.branch?.expires_at).toBeUndefined();
  });
});

describe.skip("End-to-end branch expiration", () => {
  test("branch expires after the specified time", async () => {
    // Create a branch with 5 second expiration
    let branchId: string | undefined;

    neonTesting();

    // Manually create the branch without using beforeAll/afterAll lifecycle
    const apiClient = createApiClient({
      apiKey: process.env.NEON_API_KEY!,
    });

    // Create branch with 5 second expiration
    const { data: createData } = await apiClient.createProjectBranch(
      projectId,
      {
        branch: {
          name: `test/expiration-${crypto.randomUUID()}`,
          expires_at: new Date(Date.now() + 5000).toISOString(),
        },
        endpoints: [{ type: EndpointType.ReadWrite }],
        annotation_value: {
          "integration-test": "true",
        },
      },
    );

    branchId = createData.branch.id;
    expect(branchId).toBeDefined();

    // Wait 3 seconds and verify branch still exists
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const { data: checkData1 } = await apiClient.listProjectBranches({
      projectId,
    });
    const branchExists1 = checkData1.branches.some((b) => b.id === branchId);
    expect(branchExists1).toBe(true);

    // Wait 4 more seconds (total 7 seconds) and verify branch is gone
    await new Promise((resolve) => setTimeout(resolve, 4000));

    const { data: checkData2 } = await apiClient.listProjectBranches({
      projectId,
    });
    const branchExists2 = checkData2.branches.some((b) => b.id === branchId);
    expect(branchExists2).toBe(false);
  });
});
