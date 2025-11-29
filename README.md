# Neon Testing

[![Integration tests](https://github.com/starmode-base/neon-testing/actions/workflows/test.yml/badge.svg)](https://github.com/starmode-base/neon-testing/actions/workflows/test.yml)
[![npm version](https://img.shields.io/npm/v/neon-testing)](https://www.npmjs.com/package/neon-testing)
[![GitHub release](https://img.shields.io/github/v/release/starmode-base/neon-testing)](https://github.com/starmode-base/neon-testing/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue)](LICENSE)

A [Vitest](https://vitest.dev/) utility for seamless integration tests with [Neon Postgres](https://neon.com/). <!-- A [STΛR MODΞ](https://starmode.dev) open-source project. -->

Each test file runs against its own isolated PostgreSQL database (Neon branch), ensuring clean, parallel, and reproducible testing of code that interacts with a database. Because it uses a real, isolated clone of your production database, you can test code logic that depends on database features, such as transaction rollbacks, unique constraints, and more.

**Testing against a clone of your production database lets you verify functionality that mocks cannot.**

## Features

- 🔄 **Isolated test environments** - Each test file runs against its own Postgres database with your actual schema and constraints
- 🧹 **Automatic cleanup** - Neon test branches are created and destroyed automatically
- 🐛 **Debug friendly** - Option to preserve test branches for debugging failed tests
- 🛡️ **TypeScript native** - With JavaScript support
- 🎯 **ESM only** - No CommonJS support

## How it works

1. **Branch creation**: Before tests run, a new Neon branch is created with a unique name
1. **Environment setup**: `DATABASE_URL` is set to point to your test branch
1. **Test execution**: Your tests run against the isolated database
1. **Cleanup**: After tests complete, the branch is automatically deleted

### Test isolation

Tests in the same file share a single database instance (Neon branch). This means test files are fully isolated from each other, but individual tests within a file are intentionally not isolated. This works because Vitest runs test files in [parallel](https://vitest.dev/guide/parallelism.html), while tests within each file run sequentially.

If you prefer individual tests to be isolated, you can [reset the database](examples/isolated.test.ts) in a `beforeEach` lifecycle hook.

### Automatic cleanup

Test branches are automatically deleted after your tests complete. As a safety net, branches also expire after 10 minutes by default to handle interrupted or failed test runs. This dual approach minimizes costs while protecting against edge cases like crashed processes or CI failures. Both behaviors can be customized through the `deleteBranch` and `expiresIn` options.

## Quick start

### Prerequisites

- A [Neon project](https://console.neon.tech/app/projects) with a database
- A [Neon API key](https://neon.com/docs/manage/api-keys) for programmatic access

### Install

```sh
bun add -d neon-testing vitest
```

### Minimal example

```ts
// minimal.test.ts
import { expect, test } from "vitest";
import { makeNeonTesting } from "neon-testing";
import { Pool } from "@neondatabase/serverless";

// Enable Neon test branch for this test file
makeNeonTesting({
  apiKey: process.env.NEON_API_KEY!,
  projectId: process.env.NEON_PROJECT_ID!,
  // Recommended for Neon WebSocket drivers to automatically close connections
  autoCloseWebSockets: true,
})();

test("database operations", async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  await pool.query(`CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT)`);
  await pool.query(`INSERT INTO users (name) VALUES ('Ellen Ripley')`);

  const users = await pool.query(`SELECT * FROM users`);
  expect(users.rows).toStrictEqual([{ id: 1, name: "Ellen Ripley" }]);
});
```

Source: [`examples/minimal.test.ts`](examples/minimal.test.ts)

### Recommended usage

#### 1. Plugin setup

First, add the Vite plugin to clear any existing `DATABASE_URL` environment variable before tests run, ensuring tests use isolated test databases.

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
import { neonTesting } from "neon-testing/vite";

export default defineConfig({
  plugins: [neonTesting()],
});
```

This plugin is recommended but not required. Without it, tests might accidentally use your existing `DATABASE_URL` (from `.env` files or environment variables) instead of the isolated test databases that Neon Testing creates. This can happen if you forget to call `neonTesting()` in a test file where database writes happen.

#### 2. Configuration

Use the `makeNeonTesting` factory to generate a lifecycle function for your tests.

```ts
// neon-testing.ts
import { makeNeonTesting } from "neon-testing";

// Export a configured lifecycle function to use in test files
export const neonTesting = makeNeonTesting({
  apiKey: process.env.NEON_API_KEY!,
  projectId: process.env.NEON_PROJECT_ID!,
});
```

Source: [`examples/neon-testing.ts`](examples/neon-testing.ts)

#### 3. Enable database testing

Then call the exported test lifecycle function in the test files where you need database access.

```ts
// recommended.test.ts
import { expect, test } from "vitest";
import { neonTesting } from "./neon-testing";
import { Pool } from "@neondatabase/serverless";

// Enable Neon test branch for this test file
neonTesting({
  // Recommended for Neon WebSocket drivers to automatically close connections
  autoCloseWebSockets: true,
});

test("database operations", async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  await pool.query(`CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT)`);
  await pool.query(`INSERT INTO users (name) VALUES ('Ellen Ripley')`);

  const users = await pool.query(`SELECT * FROM users`);
  expect(users.rows).toStrictEqual([{ id: 1, name: "Ellen Ripley" }]);
});
```

Source: [`examples/recommended.test.ts`](examples/recommended.test.ts)

## Drivers

This library works with any database driver that supports Neon Postgres and Vitest. The examples below demonstrate connection management, transaction support, and test isolation patterns for some popular drivers.

**IMPORTANT:** For [Neon WebSocket drivers](https://neon.com/docs/serverless/serverless-driver), enable `autoCloseWebSockets` in your `makeNeonTesting()` or `neonTesting()` configuration. This automatically closes WebSocket connections when deleting test branches, preventing connection termination errors.

### Examples

- [Neon serverless WebSocket](examples/drivers/ws-neon.test.ts)
- [Neon serverless WebSocket + Drizzle](examples/drivers/ws-neon-drizzle.test.ts)
- [Neon serverless HTTP](examples/drivers/http-neon.test.ts)
- [Neon serverless HTTP + Drizzle](examples/drivers/http-neon-drizzle.test.ts)
- [node-postgres](examples/drivers/tcp-pg.test.ts)
- [node-postgres + Drizzle](examples/drivers/tcp-pg-drizzle.test.ts)
- [Postgres.js](examples/drivers/tcp-postgres.test.ts)
- [Postgres.js + Drizzle](examples/drivers/tcp-postgres-drizzle.test.ts)

## Configuration

You configure Neon Testing in two places:

- **Base settings** in `makeNeonTesting()`
- **Optional overrides** when calling the returned function (e.g., `neonTesting()`)

Configure these in `makeNeonTesting()` and optionally override per test file when calling the returned function.

```ts
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
}
```

### Base configuration

Configure the base settings in `makeNeonTesting()`:

```ts
// neon-testing.ts
import { makeNeonTesting } from "neon-testing";

export const neonTesting = makeNeonTesting({
  apiKey: process.env.NEON_API_KEY!,
  projectId: process.env.NEON_PROJECT_ID!,
});
```

### Override configuration

Override the base configuration in specific test files when calling the function:

```ts
import { neonTesting } from "./neon-testing";

neonTesting({
  parentBranchId: "br-staging-123",
});
```

## Continuous integration

It's easy to run Neon integration tests in CI/CD pipelines:

- **GitHub Actions** — see the [example workflow](.github/workflows/test.yml)
- **Vercel** — either
  - add `vitest run` to the `build` script in [package.json](https://github.com/starmode-base/template-tanstack-start/blob/83c784e164b55fd8d59c5b57b907251e5eb03de1/app/package.json#L11), or
  - add `vitest run` to the _Build Command_ in the Vercel dashboard

## API Reference

### Main exports (`neon-testing`)

#### makeNeonTesting(options)

The factory function that creates a configured lifecycle function for your tests. See [Configuration](#configuration) for available options.

```ts
// neon-testing.ts
import { makeNeonTesting } from "neon-testing";

export const neonTesting = makeNeonTesting({
  apiKey: process.env.NEON_API_KEY!,
  projectId: process.env.NEON_PROJECT_ID!,
});
```

The configured function has the following properties:

##### `.api`

Access the Neon API client to make additional API calls:

```ts
import { neonTesting } from "./neon-testing";

const { data } = await neonTesting.api.getProjectBranch(projectId, branchId);
```

See the [Neon API client documentation](https://neon.com/docs/reference/typescript-sdk) for all available methods.

##### `.deleteAllTestBranches()`

Deletes all test branches from your Neon project. This is useful for cleanup when tests fail unexpectedly and leave orphaned test branches.

```ts
import { neonTesting } from "./neon-testing";

await neonTesting.deleteAllTestBranches();
```

The function identifies test branches by looking for the `integration-test: true` annotation that Neon Testing automatically adds to all test branches it creates.

#### Accessing branch information

When you call the configured lifecycle function in your test files, it returns a function that gives you access to the current test branch:

```ts
import { neonTesting } from "./neon-testing";

const getBranch = neonTesting();

test("access branch information", () => {
  const branch = getBranch();
  console.log(branch.id);
  console.log(branch.project_id);
  console.log(branch.expires_at);
});
```

See the [Neon Branch API documentation](https://api-docs.neon.tech/reference/getprojectbranch) for all available properties.

### Vite plugin (`neon-testing/vite`)

The Vite plugin clears any existing `DATABASE_URL` environment variable before tests run, ensuring tests use isolated test databases.

```ts
import { defineConfig } from "vitest/config";
import { neonTesting } from "neon-testing/vite";

export default defineConfig({
  plugins: [neonTesting()],
});
```

**Options:**

- `debug` (boolean, default: `false`) - Enable debug logging

This plugin is recommended but not required. Without it, tests might accidentally use your existing `DATABASE_URL` instead of isolated test databases.

### Utilities (`neon-testing/utils`)

#### lazySingleton(factory)

Creates a lazy singleton from a factory function. This is useful for managing database connections efficiently:

```ts
import { lazySingleton } from "neon-testing/utils";
import { neon } from "@neondatabase/serverless";

const sql = lazySingleton(() => neon(process.env.DATABASE_URL!));

// The connection is only created when first called
test("database operations", async () => {
  const users = await sql()`SELECT * FROM users`;
  // ...
});
```

## Contributing

Contributions are welcome! Please open issues or pull requests on [GitHub](https://github.com/starmode-base/neon-testing/pulls).

### Environment

To run tests locally, create an `.env` file in the project root with these keys:

- `NEON_API_KEY="***"`
- `NEON_PROJECT_ID="***"`

Create a free Neon project at [neon.com](https://neon.com/) to test with.

### Release

Releases are published via CI when a version tag is pushed. Use these scripts to bump the version and trigger a release:

**Stable releases:**

```sh
bun run release:patch   # 1.2.3 → 1.2.4
bun run release:minor   # 1.2.3 → 1.3.0
bun run release:major   # 1.2.3 → 2.0.0
```

**Beta releases:**

```sh
bun run release:beta          # Default: 1.2.3 → 1.2.4-beta.0, then 1.2.4-beta.1, etc.
bun run release:beta:patch    # Start beta for patch: 1.2.3 → 1.2.4-beta.0
bun run release:beta:minor    # Start beta for minor: 1.2.3 → 1.3.0-beta.0
bun run release:beta:major    # Start beta for major: 1.2.3 → 2.0.0-beta.0
```

Use `release:beta` for most beta releases. It bumps the patch version once when starting from stable, then increments the beta number for subsequent releases. Use `release:beta:minor` or `release:beta:major` only when starting a beta cycle for a larger version bump.

The scripts bump the version, create a git tag, and push to trigger CI. The command will abort if there are uncommitted changes.

## Author

Hi, I'm [Mikael Lirbank](https://www.lirbank.com/). I build robust, reliable, high-quality AI systems. I care deeply about quality—AI evals, robust test suites, clean data models, and clean architecture.

Need help building elegant systems? [I'm happy to help](https://www.lirbank.com/).
