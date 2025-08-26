# Neon testing

[![Integration tests](https://github.com/starmode-base/neon-testing/actions/workflows/test.yml/badge.svg)](https://github.com/starmode-base/neon-testing/actions/workflows/test.yml)

A [Vitest](https://vitest.dev/) utility for seamless integration tests with [Neon Postgres](https://neon.com/).

Each test file runs against its own isolated PostgreSQL database (Neon branch), ensuring clean, parallel, and reproducible testing of code that interacts with a database. Because it uses a real, isolated clone of your production database, you can test code logic that depends on database features, such as transaction rollbacks, unique constraints, and more.

**Testing against a clone of your production database lets you verify functionality that mocks cannot.**

## Features

- 🔄 **Isolated test environments** - Each test file runs against its own Postgres database with your actual schema and constraints
- 🧹 **Automatic cleanup** - Neon test branches are created and destroyed automatically
- 🐛 **Debug friendly** - Option to preserve test branches for debugging failed tests
- 🛡️ **TypeScript native** - No JavaScript support
- 🎯 **ESM only** - No CommonJS support

## How it works

1. **Branch creation**: Before tests run, a new Neon branch is created with a unique name
1. **Environment setup**: `DATABASE_URL` is set to point to your test branch
1. **Test execution**: Your tests run against the isolated database
1. **Cleanup**: After tests complete, the branch is automatically deleted

### Test isolation

Tests in the same file share a single database instance (Neon branch). This means test files are fully isolated from each other, but individual tests within a file are intentionally not isolated.

This works because Vitest runs test files in [parallel](https://vitest.dev/guide/parallelism.html), while tests within each file run sequentially.

If you prefer individual tests to be isolated, you can [reset the database](examples/isolated.test.ts) in a `beforeEach` lifecycle hook.

## Quick start

### Prerequisites

- A [Neon project](https://console.neon.tech/app/projects) with a database
- A [Neon API key](https://neon.com/docs/manage/api-keys) for programmatic access

### Install

```sh
bun add -d neon-testing
```

### Minimal example

```typescript
// minimal.test.ts
import { expect, test } from "vitest";
import { makeNeonTesting } from "neon-testing";
import { Pool } from "@neondatabase/serverless";

// Enable Neon test branch for this test file
makeNeonTesting({
  apiKey: "apiKey",
  projectId: "projectId",
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

### Recommended usage

#### 1. Configuration

Use the `makeNeonTesting` factory to generate a lifecycle function for your tests.

```typescript
// test-setup.ts
import { makeNeonTesting } from "neon-testing";

// Export a configured lifecycle function to use in test files
export const withNeonTestBranch = makeNeonTesting({
  apiKey: "apiKey",
  projectId: "projectId",
});
```

#### 2. Enable database testing

Then call the exported test lifecycle function in the test files where you need database access.

```typescript
// recommended.test.ts
import { expect, test } from "vitest";
import { withNeonTestBranch } from "./test-setup";
import { Pool } from "@neondatabase/serverless";

// Enable Neon test branch for this test file
withNeonTestBranch({
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

## Drivers

This library works with any database driver that supports Neon Postgres and Vitest. The examples below demonstrate connection management, transaction support, and test isolation patterns for some popular drivers.

**IMPORTANT:** For [Neon WebSocket drivers](https://neon.com/docs/serverless/serverless-driver), enable `autoCloseWebSockets` in your `makeNeonTesting()` or `withNeonTestBranch()` configuration. This automatically closes WebSocket connections when deleting test branches, preventing connection termination errors.

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

You configure neon-testing in two places:

- **Base settings** in `makeNeonTesting()`
- **Optional overrides** in `withNeonTestBranch()`

See all available options in [NeonTestingOptions](https://github.com/starmode-base/neon-testing/blob/main/index.ts#L33-L75).

### Base configuration

Configure the base settings in `makeNeonTesting()`:

```typescript
import { makeNeonTesting } from "neon-testing";

export const withNeonTestBranch = makeNeonTesting({
  apiKey: "apiKey",
  projectId: "projectId",
});
```

### Override configuration

Override the base configuration in specific test files with `withNeonTestBranch()`:

```typescript
import { withNeonTestBranch } from "./test-setup";

withNeonTestBranch({ parentBranchId: "br-staging-123" });
```

## Utilities

### deleteAllTestBranches()

The `deleteAllTestBranches()` function is a utility that deletes all test branches from your Neon project. This is useful for cleanup when tests fail unexpectedly and leave orphaned test branches.

```typescript
import { withNeonTestBranch } from "./test-setup";

// Access the cleanup utility
await withNeonTestBranch.deleteAllTestBranches();
```

The function identifies test branches by looking for the `integration-test: true` annotation that neon-testing automatically adds to all test branches it creates.

### lazySingleton()

The `lazySingleton()` function creates a lazy singleton from a factory function. This is useful for managing database connections efficiently:

```typescript
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

To make a new release, run:

```sh
bun run release
```

The command will abort if there are uncommitted changes in the working tree, or if the `version` in [package.json](package.json) has not been incremented.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Need help?

Hi, I’m [Mikael Lirbank](https://www.lirbank.com/). I help teams build reliable AI systems. I care about quality—AI evals, robust test suites, clean data models, and clean architecture. Sometimes I draw user interfaces.

Want to ship faster without breaking things? Let’s talk.
