/**
 * Postgres.js
 *
 * Supports interactive transactions
 *
 * https://www.npmjs.com/package/postgres
 */
import { describe, expect, test } from "vitest";
import { withNeonTestBranch } from "../test-setup";
import postgres from "postgres";

/**
 * Enable Neon database testing environment
 *
 * - Creates an isolated Neon branch for each test file
 * - Tests within a file are not isolated, they share the same branch instance
 * - The branch is deleted when all tests in the file have completed
 */
withNeonTestBranch();

describe("Postgres.js driver", () => {
  test("create table", async () => {
    const sql = postgres(process.env.DATABASE_URL!);

    await sql`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE
      )
    `;

    const newUser = await sql`
      INSERT INTO users (name)
      VALUES ('Ellen Ripley')
      RETURNING *
    `;
    expect([...newUser]).toStrictEqual([{ id: 1, name: "Ellen Ripley" }]);

    const users = await sql`SELECT * FROM users`;
    expect([...users]).toStrictEqual([{ id: 1, name: "Ellen Ripley" }]);
  });

  test("tests are not isolated", async () => {
    const sql = postgres(process.env.DATABASE_URL!);

    const newUser = await sql`
      INSERT INTO users (name)
      VALUES ('Rebecca Jorden')
      RETURNING *
    `;
    expect([...newUser]).toStrictEqual([{ id: 2, name: "Rebecca Jorden" }]);

    const users = await sql`SELECT * FROM users`;
    expect([...users]).toStrictEqual([
      // Ellen Ripley is already in the table from the previous test
      { id: 1, name: "Ellen Ripley" },
      { id: 2, name: "Rebecca Jorden" },
    ]);
  });

  test("interactive transactions are supported", async () => {
    const sql = postgres(process.env.DATABASE_URL!);

    try {
      await sql`BEGIN`;
      await sql`INSERT INTO users (name) VALUES ('Private Vasquez')`;
      // Duplicate unique constraint error - will roll back the transaction
      await sql`INSERT INTO users (name) VALUES ('Private Vasquez')`;
      await sql`COMMIT`;
    } catch (error) {
      await sql`ROLLBACK`;
    }

    const users = await sql`SELECT * FROM users`;
    expect([...users]).toStrictEqual([
      { id: 1, name: "Ellen Ripley" },
      { id: 2, name: "Rebecca Jorden" },
      // Private Vasquez is not inserted because of the transaction rollback
    ]);
  });
});
