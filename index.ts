/**
 * https://neon.com/docs/reference/typescript-sdk
 */
import {
  createApiClient,
  EndpointType,
  type ConnectionDetails,
} from "@neondatabase/api-client";
import { afterAll, beforeAll } from "vitest";
import { neonConfig } from "@neondatabase/serverless";

export { lazySingleton } from "./singleton";

/**
 * Creates a PostgreSQL connection URI from connection parameters
 *
 * @param connectionParameters - The connection parameters object
 * @param type - The type of connection to create (pooler or direct)
 * @returns A PostgreSQL connection URI string
 */
function createConnectionUri(
  connectionParameters: ConnectionDetails,
  type: "pooler" | "direct",
) {
  const { role, password, host, pooler_host, database } =
    connectionParameters.connection_parameters;

  const hostname = type === "pooler" ? pooler_host : host;

  return `postgresql://${role}:${password}@${hostname}/${database}?sslmode=require`;
}

export interface NeonTestingOptions {
  /**
   * The Neon API key, this is used to create and teardown test branches
   *
   * https://neon.com/docs/manage/api-keys#creating-api-keys
   */
  apiKey: string;
  /**
   * The Neon project ID to operate on
   *
   * https://console.neon.tech/app/projects
   */
  projectId: string;
  /**
   * The parent branch ID for the new branch. If omitted or empty, the branch
   * will be created from the project's default branch.
   */
  parentBranchId?: string;
  /**
   * Whether to create a schema-only branch (default: false)
   */
  schemaOnly?: boolean;
  /**
   * The type of connection to create (pooler is recommended)
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
}

/** Options for overriding test database setup (excludes apiKey) */
export type NeonTestingOverrides = Omit<Partial<NeonTestingOptions>, "apiKey">;

/**
 * Factory function that creates a Neon test database setup/teardown function
 * for Vitest test suites.
 *
 * @param apiKey - The Neon API key, this is used to create and teardown test branches
 * @param projectId - The Neon project ID to operate on
 * @param parentBranchId - The parent branch ID for the new branch. If omitted or empty, the branch will be created from the project's default branch.
 * @param schemaOnly - Whether to create a schema-only branch (default: false)
 * @param endpoint - The type of connection to create (pooler is recommended)
 * @param deleteBranch - Delete the test branch in afterAll (default: true). Disabling this will leave each test branch in the Neon project after the test suite runs
 * @returns A setup/teardown function for Vitest test suites
 *
 * Side effects:
 * - Sets the `DATABASE_URL` environment variable to the connection URI for the
 *   new branch
 * - Deletes the test branch after the test suite runs
 */
export function makeNeonTesting(factoryOptions: NeonTestingOptions) {
  const apiClient = createApiClient({ apiKey: factoryOptions.apiKey });

  /**
   * Delete all test branches
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

  const testDbSetup = (
    /** Override any factory options except apiKey */
    overrides?: NeonTestingOverrides,
  ) => {
    // Merge factory options with overrides
    const options = { ...factoryOptions, ...overrides };

    // Each test file gets its own branch ID and database client
    let branchId: string | undefined;

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
      const { data } = await apiClient.createProjectBranch(options.projectId, {
        branch: {
          name: `test/${crypto.randomUUID()}`,
          parent_id: options.parentBranchId,
          init_source: options.schemaOnly ? "schema-only" : undefined,
        },
        endpoints: [{ type: EndpointType.ReadWrite }],
        annotation_value: {
          "integration-test": "true",
        },
      });

      branchId = data.branch.id;

      const [connectionUri] = data.connection_uris ?? [];

      if (!connectionUri) {
        throw new Error("No connection URI found");
      }

      return createConnectionUri(connectionUri, options.endpoint ?? "pooler");
    }

    /**
     * Delete the test branch
     */
    async function deleteBranch() {
      if (!branchId) {
        throw new Error("No branch to delete");
      }

      await apiClient.deleteProjectBranch(options.projectId, branchId);
      branchId = undefined;
    }

    beforeAll(async () => {
      process.env.DATABASE_URL = await withRetry(createBranch, {
        maxRetries: 5,
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
  };

  // Attach the utility
  testDbSetup.deleteAllTestBranches = deleteAllTestBranches;

  return testDbSetup;
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
