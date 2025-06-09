/**
 * @neondatabase/serverless
 *
 * Supports interactive transactions
 *
 * https://www.npmjs.com/package/@neondatabase/serverless
 */
import { describe, expect, test } from "vitest";
import { withNeonTestBranch } from "../test-setup";
import { Pool } from "@neondatabase/serverless";

const endpoints = ["pooler", "direct"] as const;

describe.each(endpoints)("Neon serverless websockets (%s)", (endpoint) => {
  withNeonTestBranch({ endpoint });

  test("create table", async () => {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });

    await pool.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE
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

    await pool.end();
  });

  test("tests are not isolated", async () => {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });

    const newUser = await pool.query(`
      INSERT INTO users (name)
      VALUES ('Rebecca Jorden')
      RETURNING *
    `);
    expect(newUser.rows).toStrictEqual([{ id: 2, name: "Rebecca Jorden" }]);

    const users = await pool.query(`SELECT * FROM users`);
    expect(users.rows).toStrictEqual([
      // Ellen Ripley is already in the table from the previous test
      { id: 1, name: "Ellen Ripley" },
      { id: 2, name: "Rebecca Jorden" },
    ]);

    await pool.end();
  });

  test("interactive transactions are supported", async () => {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      await client.query(`INSERT INTO users (name) VALUES ('Private Vasquez')`);
      // Duplicate unique constraint error - will roll back the transaction
      await client.query(`INSERT INTO users (name) VALUES ('Private Vasquez')`);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }

    const users = await client.query(`SELECT * FROM users`);
    expect(users.rows).toStrictEqual([
      { id: 1, name: "Ellen Ripley" },
      { id: 2, name: "Rebecca Jorden" },
      // Private Vasquez is not inserted because of the transaction rollback
    ]);

    await pool.end();
  });
});
