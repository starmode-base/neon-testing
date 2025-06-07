/**
 * https://neon.com/docs/reference/typescript-sdk
 */
import { createApiClient, EndpointType } from "@neondatabase/api-client";
import { afterAll, beforeAll } from "vitest";

/**
 * Factory function that creates a Neon test database setup/teardown function
 * for Vitest test suites.
 *
 * @param apiKey - The Neon API key
 * @param projectId - The Neon project ID
 * @param parentBranchId - The parent branch ID for the new branch
 * @param schemaOnly - Whether to create a schema-only branch
 * @returns A setup/teardown function for Vitest test suites
 *
 * Side effects:
 * - Sets the `DATABASE_URL` environment variable to the connection URI for the
 *   new branch
 * - Deletes the test branch after the test suite runs
 */
export function makeNeonTestDatabase({
  apiKey,
  projectId,
  parentBranchId: factoryParentBranchId,
  schemaOnly: factorySchemaOnly,
}: {
  apiKey: string;
  projectId: string;
  parentBranchId?: string;
  schemaOnly?: "schema-only";
}) {
  return (parentBranchId?: string, schemaOnly?: "schema-only") => {
    const apiClient = createApiClient({ apiKey });

    // Each test file gets its own branch ID and database client
    let branchId: string | undefined;

    /**
     * Create a new test branch
     *
     * @returns The connection URI for the new branch
     */
    async function createBranch() {
      const { data } = await apiClient.createProjectBranch(projectId, {
        branch: {
          name: `test/${crypto.randomUUID()}`,
          parent_id: parentBranchId ?? factoryParentBranchId,
          init_source:
            (schemaOnly ?? factorySchemaOnly) ? "schema-only" : undefined,
        },
        endpoints: [{ type: EndpointType.ReadWrite }],
        annotation_value: {
          "integration-test": "true",
        },
      });

      branchId = data.branch.id;

      const connectionUri = data.connection_uris?.[0]?.connection_uri;
      if (!connectionUri) {
        throw new Error("No connection URI found");
      }

      return connectionUri;
    }

    /**
     * Delete all test branches
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async function deleteAllTestBranches() {
      const { data } = await apiClient.listProjectBranches({ projectId });

      for (const branch of data.branches) {
        const isTestBranch =
          data.annotations[branch.id]?.value["integration-test"] === "true";

        if (isTestBranch) {
          await apiClient.deleteProjectBranch(projectId, branch.id);
        }
      }
    }

    /**
     * Delete the test branch
     */
    async function deleteBranch() {
      if (!branchId) {
        throw new Error("No branch to delete");
      }

      await apiClient.deleteProjectBranch(projectId, branchId);
      branchId = undefined;
    }

    beforeAll(async () => {
      const connectionUri = await createBranch();
      process.env.DATABASE_URL = connectionUri;
    });

    afterAll(async () => {
      await deleteBranch();
      process.env.DATABASE_URL = undefined;

      // await deleteAllTestBranches();
    });
  };
}
