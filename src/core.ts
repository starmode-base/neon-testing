/**
 * https://neon.com/docs/reference/typescript-sdk
 */
import {
  createApiClient,
  EndpointType,
  type Branch,
} from "@neondatabase/api-client";
import { applySslMode } from "./lib/ssl";
import { validateExpiresIn } from "./lib/expires-in";
import { neonWsErrorHandler } from "./lib/ws-error";
import { withRetry } from "./lib/with-retry";

/**
 * Test-runner lifecycle hooks
 *
 * Injected so the core stays runner-agnostic. Most users don't build these by
 * hand — import the pre-wired factory from `neon-testing/vitest` or
 * `neon-testing/bun`, which supply them automatically.
 */
export interface NeonTestingHooks {
  beforeAll: (fn: () => void | Promise<void>) => void;
  afterAll: (fn: () => void | Promise<void>) => void;
}

/**
 * Configuration for the Neon test-branch factory.
 *
 * `hooks` are injected by the per-runner entry (`neon-testing/vitest` or
 * `neon-testing/bun`); the remaining fields control how each test branch is
 * created and torn down.
 */
export interface MakeNeonTestingCoreOptions {
  /**
   * Test-runner lifecycle hooks (supplied by `neon-testing/vitest` or
   * `neon-testing/bun`)
   */
  hooks: NeonTestingHooks;
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
   *
   * Vitest only — under Bun the uncaughtException suppression does not
   * intercept, so close connections explicitly there instead.
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
  /**
   * Override the `sslmode` query param on the connection URI (default:
   * undefined — URI is passed through unchanged)
   *
   * Neon's API returns URIs with `sslmode=require`. In pg v9 the meaning of
   * `require` changes to libpq semantics (encrypt, but don't verify the CA).
   *
   * - `"verify-full"` — strict CA verification (silences the pg v9 warning)
   * - `"require"` — preserves today's effective behavior under pg v9 by also
   *   setting `uselibpqcompat=true`
   *
   * Only affects drivers that parse `sslmode` (e.g. `pg`). The Neon
   * serverless driver ignores it.
   */
  sslMode?: "verify-full" | "require";
}

/** Options for the `makeNeonTesting` factories — core options minus the injected hooks */
export type MakeNeonTestingOptions = Omit<MakeNeonTestingCoreOptions, "hooks">;

/** Per-file overrides accepted by the returned `neonTesting()` function */
export type NeonTestingOptions = Partial<
  Omit<MakeNeonTestingOptions, "apiKey">
>;

/**
 * Low-level factory that creates a Neon test-branch setup/teardown function.
 * Runner-agnostic — you inject the lifecycle hooks via `options.hooks`.
 *
 * Most users want a pre-wired entry instead: `neon-testing/vitest` or
 * `neon-testing/bun`. Reach for this core factory only for other runners
 * (jest, node:test, …).
 *
 * @param factoryOptions - see {@link MakeNeonTestingCoreOptions}
 * @returns A setup/teardown function with attached utilities:
 *  - `deleteAllTestBranches()` - delete all test branches
 *  - `api` - the Neon API client
 *
 * @example
 * ```ts
 * import { beforeAll, afterAll } from "vitest"; // or any runner
 * import { makeNeonTestingCore } from "neon-testing/core";
 *
 * export const neonTesting = makeNeonTestingCore({
 *   apiKey: process.env.NEON_API_KEY!,
 *   projectId: process.env.NEON_PROJECT_ID!,
 *   hooks: { beforeAll, afterAll },
 * });
 * ```
 */
export function makeNeonTestingCore(
  factoryOptions: MakeNeonTestingCoreOptions,
) {
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
   * Setup/teardown function for a test file.
   *
   * Registers lifecycle hooks (via the injected `hooks`) that:
   * - Create an isolated test branch from your parent branch
   * - Set `DATABASE_URL` environment variable to the test branch connection URI
   * - Automatically delete the test branch after tests complete (unless `deleteBranch: false`)
   * - Automatically expire branches after 10 minutes for cleanup (unless `expiresIn: null`)
   *
   * @param overrides - Optional per-file overrides for the factory options
   * @returns A function that provides access to the current Neon branch object
   */
  const neonTesting = (
    /** Override any factory options except apiKey */
    overrides?: NeonTestingOptions,
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
    // Lazily initialized when autoCloseWebSockets is enabled (avoids
    // referencing the WebSocket global on runtimes that lack it, e.g. Node 20)
    let neonSockets: Set<WebSocket> | undefined;

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
          ...(options.parentBranchId
            ? { parent_id: options.parentBranchId }
            : {}),
          ...(options.schemaOnly ? { init_source: "schema-only" } : {}),
          ...(expiresAt ? { expires_at: expiresAt } : {}),
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

      return applySslMode(uriData.uri, options.sslMode);
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

    factoryOptions.hooks.beforeAll(async () => {
      process.env.DATABASE_URL = await withRetry(createBranch, {
        maxRetries: 8,
        baseDelayMs: 1000,
      });

      if (options.autoCloseWebSockets) {
        neonSockets = new Set<WebSocket>();

        // Custom WebSocket constructor that tracks Neon WebSocket connections
        class TrackingWebSocket extends WebSocket {
          constructor(url: string) {
            super(url);

            // Only track Neon WebSocket connections
            if (!url.includes(".neon.tech/")) return;

            neonSockets!.add(this);
          }
        }

        // Install a custom WebSocket constructor that tracks Neon WebSocket
        // connections and closes them before deleting the branch
        try {
          const { neonConfig } = await import("@neondatabase/serverless");
          neonConfig.webSocketConstructor = TrackingWebSocket;
        } catch {
          throw new Error(
            "autoCloseWebSockets requires @neondatabase/serverless to be installed. Run: npm install @neondatabase/serverless",
          );
        }
      }
    });

    factoryOptions.hooks.afterAll(async () => {
      delete process.env.DATABASE_URL;

      // Close all tracked Neon WebSocket connections before deleting the branch
      if (options.autoCloseWebSockets && neonSockets) {
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
