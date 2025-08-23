# Neon testing

A Vitest utility for automated integration tests with [Neon](https://neon.com/).

Each test file runs against its own isolated PostgreSQL database (Neon branch), ensuring clean, parallel, and reproducible testing of code that relies on a database. Because it uses a real database, you can test code logic that depends on database features such as transaction rollbacks, unique constraints, and more.

Using an actual clone of your production database for integration testing lets you verify functionality that mocks cannot.

## Features

- 🔄 **Isolated test environments** - Each test file runs against its own Postgres database with your actual schema and constraints
- 🧹 **Automatic cleanup** - Neon test branches are created and destroyed automatically
- 🛡️ **TypeScript native** - No JavaScript support
- 🎯 **ESM only** - No CommonJS support

## How it works

1. **Branch creation**: Before tests run, a new Neon branch is created with a unique name
1. **Environment setup**: `DATABASE_URL` is set to point to your test branch
1. **Test execution**: Your tests run against the isolated database
1. **Cleanup**: After tests complete, the branch is automatically deleted

### Test isolation

Tests within a test file share the same database instance (Neon branch), so while all test files are isolated, tests within a test file are intentionally not.

This works because Vitest runs test files in parallel, but tests within each test file run sequentially one at a time.

If you prefer individual tests within a test file to be isolated, [simply clean up the database in a beforeEach lifecycle](examples/isolated.test.ts).

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
// database.test.ts
import { expect, test } from "vitest";
import { makeNeonTesting } from "neon-testing";
import { Pool } from "@neondatabase/serverless";

// Enable Neon test branch for this test file
makeNeonTesting({ apiKey: "apiKey", projectId: "projectId" })();

test("database operations", async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  await pool.query(`CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT)`);
  await pool.query(`INSERT INTO users (name) VALUES ('Ellen Ripley')`);

  const users = await pool.query(`SELECT * FROM users`);
  expect(users.rows).toStrictEqual([{ id: 1, name: "Ellen Ripley" }]);

  await pool.end();
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

See all available options in [NeonTestingOptions](https://github.com/starmode-base/neon-testing/blob/main/index.ts#L30-L63).

#### 2. Enable database testing

Then call the exported test lifecycle function in the test files where you need database access.

```typescript
// database.test.ts
import { expect, test } from "vitest";
import { withNeonTestBranch } from "./test-setup";
import { Pool } from "@neondatabase/serverless";

// Enable Neon test branch for this test file
withNeonTestBranch();

test("database operations", async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  await pool.query(`CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT)`);
  await pool.query(`INSERT INTO users (name) VALUES ('Ellen Ripley')`);

  const users = await pool.query(`SELECT * FROM users`);
  expect(users.rows).toStrictEqual([{ id: 1, name: "Ellen Ripley" }]);

  await pool.end();
});
```

#### Override configuration

Branch from a specific branch instead of the default branch:

```typescript
import { withNeonTestBranch } from "./test-setup";

withNeonTestBranch({ parentBranchId: "br-staging-123" });
```

Don't copy data when branching:

```typescript
import { withNeonTestBranch } from "./test-setup";

withNeonTestBranch({ schemaOnly: true });
```

See all available options in [NeonTestingOptions](https://github.com/starmode-base/neon-testing/blob/main/index.ts#L30-L63).

## Cleanup utilities

### deleteAllTestBranches()

The `deleteAllTestBranches()` function is a utility that deletes all test branches from your Neon project. This is useful for cleanup when tests fail unexpectedly and leave orphaned test branches.

```typescript
import { withNeonTestBranch } from "./test-setup";

// Access the cleanup utility
await withNeonTestBranch.deleteAllTestBranches();
```

The function identifies test branches by looking for the `integration-test: true` annotation that neon-testing automatically adds to all test branches it creates.

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

## Need expert help?

Hi, I'm [@lirbank](https://github.com/lirbank). I take on a few consulting projects each year where I help companies build, unblock, and ship. Here's what I do:

**[STΛR MODΞ](https://www.starmode.dev/)** — A boutique AI development studio I run with AI/ML expert and data scientist [@spencer-g-smith](https://github.com/spencer-g-smith). We help companies build accurate AI solutions: AI-first apps, advanced workflows, and agentic systems.

**[Mikael Lirbank](https://www.lirbank.com/)** — My solo practice, focused on web app development, test automation, code quality, and technical architecture. I'm friendly and happy to help with the hard stuff.
