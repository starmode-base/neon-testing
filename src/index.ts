/**
 * https://neon.com/docs/reference/typescript-sdk
 */
import {
  createApiClient,
  EndpointType,
  type Branch,
} from "@neondatabase/api-client";
import { afterAll, beforeAll } from "vitest";
import { neonConfig } from "@neondatabase/serverless";

/**
 * Validates the expiresIn option
 */
function validateExpiresIn(expiresIn: number | null | undefined) {
  if (expiresIn !== null && expiresIn !== undefined) {
    if (!Number.isInteger(expiresIn)) {
      throw new Error("expiresIn must be an integer");
    }

    if (expiresIn <= 0) {
      throw new Error("expiresIn must be a positive integer");
    }

    if (expiresIn > 2592000) {
      throw new Error("expiresIn must not exceed 30 days (2,592,000 seconds)");
    }
  }
}

export interface NeonTestingOptions {
  /**
   * The Neon API key, this is used to create and teardown test branches (required)
   *
   * https://neon.com/docs/manage/api-keys#creating-api-keys
   */
  apiKey: string;
  /**
   * The Neon project ID to operate on (required)
   *
   * https://console.neon.tech/app/projects
   */
  projectId: string;
  /**
   * The parent branch ID for the new branch (default: undefined)
   *
   * If omitted or undefined, test branches will be created from the project's
   * default branch.
   */
  parentBranchId?: string;
  /**
   * Whether to create a schema-only branch (default: false)
   */
  schemaOnly?: boolean;
  /**
   * The type of connection to create (default: "pooler")
   */
  endpoint?: "pooler" | "direct";
  /**
   * Delete the test branch in afterAll (default: true)
   *
   * Disabling this will leave each test branch in the Neon project after the
   * test suite runs
   */
  deleteBranch?: boolean;
  /**
   * Automatically close Neon WebSocket connections opened during tests before
   * deleting the branch (default: false)
   *
   * Suppresses the specific Neon WebSocket "Connection terminated unexpectedly"
   * error that may surface when deleting a branch with open WebSocket
   * connections
   */
  autoCloseWebSockets?: boolean;
  /**
   * Time in seconds until the branch expires and is automatically deleted
   * (default: 600 = 10 minutes)
   *
   * This provides automatic cleanup for dangling branches from interrupted or
   * failed test runs. Set to `null` to disable automatic expiration.
   *
   * Must be a positive integer. Maximum 30 days (2,592,000 seconds).
   *
   * https://neon.com/docs/guides/branch-expiration
   */
  expiresIn?: number | null;
  /**
   * The database role to connect as (default: project owner role)
   *
   * The role must exist in the parent branch. Roles are automatically
   * copied to test branches when branching.
   */
  roleName?: string;
  /**
   * The database to connect to (default: project default database)
   */
  databaseName?: string;
}

/** Options for overriding test database setup (excludes apiKey) */
export type NeonTestingOverrides = Omit<Partial<NeonTestingOptions>, "apiKey">;

/**
 * Factory function that creates a Neon test database setup/teardown function
 * for Vitest test suites.
 *
 * @param factoryOptions - Configuration options (see {@link NeonTestingOptions})
 * @returns A setup/teardown function with attached utilities:
 *  - `deleteAllTestBranches()` - Cleanup method to delete all test branches
 *  - `api` - Direct access to the Neon API client
 *
 * @example
 * ```ts
 * // neon-testing.ts
 * import { makeNeonTesting } from "neon-testing";
 *
 * export const neonTesting = makeNeonTesting({
 *   apiKey: "apiKey",
 *   projectId: "projectId",
 * });
 * ```
 *
 * @example
 * ```ts
 * // my-test.test.ts
 * import { neonTesting } from "./neon-testing";
 *
 * const getBranch = neonTesting();
 *
 * test("my test", () => {
 *   const branch = getBranch();
 *   console.log(branch.id);
 * });
 * ```
 */
export function makeNeonTesting(factoryOptions: NeonTestingOptions) {
  // Validate factory options
  validateExpiresIn(factoryOptions.expiresIn);

  const apiClient = createApiClient({ apiKey: factoryOptions.apiKey });

  /**
   * Delete all test branches (branches with the "integration-test: true" annotation)
   */
  async function deleteAllTestBranches() {
    const { data } = await apiClient.listProjectBranches({
      projectId: factoryOptions.projectId,
    });

    for (const branch of data.branches) {
      const isTestBranch =
        data.annotations[branch.id]?.value["integration-test"] === "true";

      if (isTestBranch) {
        await apiClient.deleteProjectBranch(
          factoryOptions.projectId,
          branch.id,
        );
      }
    }
  }

  /**
   * Setup/teardown function for Vitest test suites
   *
   * Registers Vitest lifecycle hooks that:
   * - Create an isolated test branch from your parent branch
   * - Set `DATABASE_URL` environment variable to the test branch connection URI
   * - Automatically delete the test branch after tests complete (unless `deleteBranch: false`)
   * - Automatically expire branches after 10 minutes for cleanup (unless `expiresIn: null`)
   *
   * @param overrides - Optional overrides for the factory options
   * @returns A function that provides access to the current Neon branch object
   */
  const neonTesting = (
    /** Override any factory options except apiKey */
    overrides?: NeonTestingOverrides,
  ) => {
    // Validate overrides
    if (overrides?.expiresIn !== undefined) {
      validateExpiresIn(overrides.expiresIn);
    }

    // Merge factory options with overrides
    const options = { ...factoryOptions, ...overrides };

    // Each test file gets its own branch and database client
    let branch: Branch | undefined;

    // List of tracked Neon WebSocket connections
    const neonSockets = new Set<WebSocket>();

    // Custom WebSocket constructor that tracks Neon WebSocket connections
    class TrackingWebSocket extends WebSocket {
      constructor(url: string) {
        super(url);

        // Only track Neon WebSocket connections
        if (!url.includes(".neon.tech/")) return;

        neonSockets.add(this);
      }
    }

    /**
     * Create a new test branch
     *
     * @returns The connection URI for the new branch
     */
    async function createBranch() {
      // Calculate expiration timestamp if expiresIn is set
      const expiresIn =
        options.expiresIn === undefined ? 600 : options.expiresIn; // Default: 10 minutes

      const expiresAt =
        expiresIn !== null
          ? new Date(Date.now() + expiresIn * 1000).toISOString()
          : undefined;

      const { data } = await apiClient.createProjectBranch(options.projectId, {
        branch: {
          name: `test/${crypto.randomUUID()}`,
          parent_id: options.parentBranchId,
          init_source: options.schemaOnly ? "schema-only" : undefined,
          expires_at: expiresAt,
        },
        endpoints: [{ type: EndpointType.ReadWrite }],
        annotation_value: {
          "integration-test": "true",
        },
      });

      branch = data.branch;

      // Determine role and database (handles multi-role/database projects)
      const targetRole =
        options.roleName ??
        data.roles?.find((r) => r.name === "neondb_owner")?.name ??
        data.roles?.[0]?.name;
      const targetDatabase =
        options.databaseName ??
        data.databases?.find((d) => d.name === "neondb")?.name ??
        data.databases?.[0]?.name;

      if (!targetRole) {
        throw new Error("No role available in branch");
      }
      if (!targetDatabase) {
        throw new Error("No database available in branch");
      }

      // Validate specified role exists
      if (
        options.roleName &&
        !data.roles?.some((r) => r.name === options.roleName)
      ) {
        throw new Error(`Role not found: ${options.roleName}`);
      }

      // Validate specified database exists
      if (
        options.databaseName &&
        !data.databases?.some((d) => d.name === options.databaseName)
      ) {
        throw new Error(`Database not found: ${options.databaseName}`);
      }

      // Use getConnectionUri API (works for all cases, including multi-role projects)
      const { data: uriData } = await apiClient.getConnectionUri({
        projectId: options.projectId,
        branch_id: branch.id,
        role_name: targetRole,
        database_name: targetDatabase,
        pooled: options.endpoint !== "direct",
      });

      return uriData.uri;
    }

    /**
     * Delete the test branch
     */
    async function deleteBranch() {
      if (!branch?.id) {
        throw new Error("No branch to delete");
      }

      await apiClient.deleteProjectBranch(options.projectId, branch.id);
      branch = undefined;
    }

    beforeAll(async () => {
      process.env.DATABASE_URL = await withRetry(createBranch, {
        maxRetries: 8,
        baseDelayMs: 1000,
      });

      if (options.autoCloseWebSockets) {
        // Install a custom WebSocket constructor that tracks Neon WebSocket
        // connections and closes them before deleting the branch
        neonConfig.webSocketConstructor = TrackingWebSocket;
      }
    });

    afterAll(async () => {
      process.env.DATABASE_URL = undefined;

      // Close all tracked Neon WebSocket connections before deleting the branch
      if (options.autoCloseWebSockets) {
        // Suppress Neon WebSocket "Connection terminated unexpectedly" error
        process.prependListener("uncaughtException", neonWsErrorHandler);

        // Close tracked Neon WebSocket connections before deleting the branch
        neonSockets.forEach((ws) => ws.close());
      }

      if (options.deleteBranch !== false) {
        await deleteBranch();
      }
    });

    /**
     * Return the Neon branch object
     *
     * @returns The Neon branch object
     */
    return () => branch;
  };

  // Attach utilities
  neonTesting.deleteAllTestBranches = deleteAllTestBranches;
  neonTesting.api = apiClient;

  return neonTesting;
}

/**
 * Error handler: Suppress Neon WebSocket "Connection terminated unexpectedly"
 * error
 */
const neonWsErrorHandler = (error: Error) => {
  const isNeonWsClose =
    error.message.includes("Connection terminated unexpectedly") &&
    error.stack?.includes("@neondatabase/serverless");

  if (isNeonWsClose) {
    // Swallow this specific Neon WS termination error
    return;
  }

  // For any other error, detach and rethrow
  throw error;
};

/**
 * Reusable API call wrapper with automatic retry on 423 errors with exponential
 * backoff
 *
 * https://neon.com/docs/reference/typescript-sdk#error-handling
 * https://neon.com/docs/changelog/2022-07-20
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries: number;
    baseDelayMs: number;
  },
): Promise<T> {
  if (!Number.isInteger(options.maxRetries) || options.maxRetries <= 0) {
    throw new Error("maxRetries must be a positive integer");
  }

  if (!Number.isInteger(options.baseDelayMs) || options.baseDelayMs <= 0) {
    throw new Error("baseDelayMs must be a positive integer");
  }

  for (let attempt = 1; attempt <= options.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const status = error?.response?.status;

      if (status === 423 && attempt < options.maxRetries) {
        const delay = options.baseDelayMs * Math.pow(2, attempt - 1);

        console.log(
          `API call failed with 423, retrying in ${delay}ms (attempt ${attempt}/${options.maxRetries})`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));

        continue;
      }

      throw error;
    }
  }
  throw new Error("apiCallWithRetry reached unexpected end");
}
