/**
 * node-postgres
 *
 * https://www.npmjs.com/package/pg
 */
import { expect, test } from "vitest";
import { withNeonTestBranch } from "./test-helpers";
import { Pool } from "pg";

/**
 * Enable Neon database testing environment
 *
 * - Creates an isolated Neon branch for each test file
 * - Tests within a file are not isolated, they share the same branch instance
 * - The branch is deleted when all tests in the file have completed
 */
withNeonTestBranch();

test("node-postgres driver", async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });

  await pool.query(`
    CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL
    )
  `);

  const newUser = await pool.query(`
    INSERT INTO users (name)
    VALUES ('Ellen Ripley')
    RETURNING *
  `);
  expect(newUser.rows[0]).toStrictEqual({ id: 1, name: "Ellen Ripley" });

  const users = await pool.query(`SELECT * FROM users`);
  expect(users.rows).toStrictEqual([{ id: 1, name: "Ellen Ripley" }]);

  pool.end();
});

test("node-postgres driver with transactions", async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(`INSERT INTO users (name) VALUES ('Rebecca Jorden')`);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  const users = await client.query(`SELECT * FROM users`);
  expect(users.rows).toStrictEqual([
    // Note the same Neon branch is used for all tests in the same file, clean
    // it up manually if you want a clean slate for each test.
    { id: 1, name: "Ellen Ripley" },
    { id: 2, name: "Rebecca Jorden" },
  ]);
});
