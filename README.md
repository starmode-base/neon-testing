# Neon testing

A Vitest utility for running database tests with isolated [Neon](https://neon.com/) branches. Each test file gets its own dedicated PostgreSQL database (Neon branch), ensuring clean, parallel, and reproducible tests.

## Features

- 🔄 **Isolated test environments** - Each test file runs against its own Neon branch
- 🧹 **Automatic cleanup** - Neon test branches are created and destroyed automatically
- 🛡️ **TypeScript native** - No JavaScript support
- 🎯 **ESM only** - No CommonJS support

## How it works

1. **Branch Creation**: Before tests run, a new Neon branch is created with a unique name
1. **Environment Setup**: `DATABASE_URL` is set to point to your test branch
1. **Test Execution**: Your tests run against the isolated database
1. **Cleanup**: After tests complete, the branch is automatically deleted

Each test file gets its own branch, but tests within a file share the same database instance.

## Isolate individual tests

Tests within a single test file shares the same database instance (Neon branch), so while all test files are isolated, tests within a test file are not. If you prefer individual tests within a test file to be isolated, [simply can clean up the database in a beforeEach lifecycle](examples/neon-serverless-http-isolated.test.ts).

This works because Vitest runs test files in parallel, but tests within each test file are run one at the time.

## Quick start

### Prerequisites

- A [Neon project](https://console.neon.tech/app/projects) with a database
- A [Neon API key](https://neon.tech/docs/manage/api-keys) for programmatic access

### Install

```bash
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

// Export a configured life cycle function to use in test files
export const withNeonTestBranch = makeNeonTesting({
  apiKey: "apiKey",
  projectId: "projectId",
});
```

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

Branch from a specific branch instead of main:

```typescript
import { withNeonTestBranch } from "./test-setup";

withNeonTestBranch("br-staging-123");
```

Don't copy data when branching:

```typescript
import { withNeonTestBranch } from "./test-setup";

withNeonTestBranch(undefined, "schema-only");
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please open issues or pull requests on [GitHub](https://github.com/starmode-base/neon-testing/pulls).

## Support

For questions or support, open an issue or join our [community discussions](#).
