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

// Export a configured lifecycle function to use in test files
export const withNeonTestBranch = makeNeonTesting({
  apiKey: "apiKey",
  projectId: "projectId",
});
```

See all available options in [NeonTestingOptions](https://github.com/starmode-base/neon-testing/blob/main/index.ts#L30-L41).

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

withNeonTestBranch({ parentBranchId: "br-staging-123" });
```

Don't copy data when branching:

```typescript
import { withNeonTestBranch } from "./test-setup";

withNeonTestBranch({ schemaOnly: true });
```

See all available options in [NeonTestingOptions](https://github.com/starmode-base/neon-testing/blob/main/index.ts#L30-L41).

## Isolate individual tests

Tests within a single test file share the same database instance (Neon branch), so while all test files are isolated, tests within a test file are not. If you prefer individual tests within a test file to be isolated, [simply clean up the database in a beforeEach lifecycle](examples/neon-serverless-http-isolated.test.ts).

This works because Vitest runs test files in parallel, but tests within each test file run one at a time.

## Contributing

Contributions are welcome! Please open issues or pull requests on [GitHub](https://github.com/starmode-base/neon-testing/pulls).

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

If you find this project helpful, consider giving it a ⭐️ on [GitHub](https://github.com/starmode-base/neon-testing)

## Need expert help?

I take on a few consulting projects each year where I can build, unblock, and ship.

[STΛR MODΞ](https://www.starmode.dev/) — The AI development studio I run with AI/ML expert and data scientist Spencer Smith. We help companies build accurate AI solutions: AI-first apps, advanced workflows, and agentic systems.

[Mikael Lirbank](https://www.lirbank.com/) — My solo practice, focused on web app development, test automation, code quality, and technical architecture. I'm around, friendly, and happy to help with the hard stuff.
