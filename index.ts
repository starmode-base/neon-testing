/**
 * https://neon.com/docs/reference/typescript-sdk
 */
import {
  createApiClient,
  EndpointType,
  type ConnectionDetails,
} from "@neondatabase/api-client";
import { afterAll, beforeAll } from "vitest";
import {
  neonConfig,
  type WebSocketConstructor,
} from "@neondatabase/serverless";

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
  /** The parent branch ID for the new branch */
  parentBranchId?: string;
  /** Whether to create a schema-only branch (default: false) */
  schemaOnly?: boolean;
  /** The type of connection to create (pooler is recommended) */
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
 * @param apiKey - The Neon API key
 * @param projectId - The Neon project ID
 * @param endpoint - The type of connection to create (pooler or direct, default: pooler)
 * @param parentBranchId - The parent branch ID for the new branch
 * @param schemaOnly - Whether to create a schema-only branch
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

    // Scoped handlers to temporarily suppress Neon WS close errors
    let neonWsErrorHandler: ((err: Error) => void) | undefined;

    // WebSocket tracking to gracefully close Neon sockets before deletion
    const trackedNeonSockets = new Set<WebSocket>();

    // Installs a custom WebSocket constructor that tracks Neon WebSocket
    // connections and closes them before deleting the branch
    const installNeonWebSocketTracker = () => {
      const baseCtor = neonConfig.webSocketConstructor ?? globalThis.WebSocket;

      const TrackingWebSocket = class extends (baseCtor as any) {
        constructor(url: any, protocols?: any) {
          super(url, protocols);

          const href =
            typeof url === "string" ? url : String(url?.toString?.() ?? "");

          if (href.includes(".neon.tech/")) {
            trackedNeonSockets.add(this as any);
            this.addEventListener(
              "close",
              () => trackedNeonSockets.delete(this as any),
              { once: true },
            );
          }
        }
      };

      neonConfig.webSocketConstructor = TrackingWebSocket as any;
    };

    const closeTrackedNeonWebSockets = async (timeoutMs = 1000) => {
      const sockets = Array.from(trackedNeonSockets);
      trackedNeonSockets.clear();

      sockets.forEach((ws) => ws.close());
    };

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
      process.env.DATABASE_URL = await createBranch();

      if (options.autoCloseWebSockets) {
        // Track Neon WebSocket connections to close them before deleting the
        // branch
        installNeonWebSocketTracker();

        // Suppress the specific Neon WS "Connection terminated unexpectedly"
        // error that may surface when deleting a branch with open websocket
        // connections
        neonWsErrorHandler = (err) => {
          const isNeonWsClose =
            err.message.includes("Connection terminated unexpectedly") &&
            err.stack?.includes("@neondatabase/serverless");

          if (isNeonWsClose) {
            // Swallow only this specific Neon WS termination error
            return;
          }

          // For any other error, detach and rethrow
          if (neonWsErrorHandler) {
            process.removeListener("uncaughtException", neonWsErrorHandler);
          }
          throw err;
        };

        process.prependListener("uncaughtException", neonWsErrorHandler);
      }
    });

    afterAll(async () => {
      if (options.autoCloseWebSockets) {
        await closeTrackedNeonWebSockets();
      }

      if (options.deleteBranch !== false) {
        await deleteBranch();
      }
      process.env.DATABASE_URL = undefined;

      if (neonWsErrorHandler) {
        process.removeListener("uncaughtException", neonWsErrorHandler);
        neonWsErrorHandler = undefined;
      }
    });
  };

  // Attach the utility
  testDbSetup.deleteAllTestBranches = deleteAllTestBranches;

  return testDbSetup;
}
