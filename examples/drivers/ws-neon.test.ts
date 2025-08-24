/**
 * @neondatabase/serverless
 *
 * Protocol:                                  | WebSocket
 * Driver:                                    | @neondatabase/serverless
 * ORM:                                       | -
 * Interactive transactions                   | ✅
 * Automatic connection lifecycle management  | ❌
 *
 * https://www.npmjs.com/package/@neondatabase/serverless
 */
import { describe, expect, test } from "vitest";
import { withNeonTestBranch } from "../test-setup";
import { Pool } from "@neondatabase/serverless";

const cases = [
  [
    "pooler",
    (url: string) => {
      const pool = new Pool({ connectionString: url });
      return {
        sql: (query: string) => pool.query(query),
        end: () => pool.end(),
      };
    },
  ],
  [
    "direct",
    (url: string) => {
      const pool = new Pool({ connectionString: url });
      return {
        sql: (query: string) => pool.query(query),
        end: () => pool.end(),
      };
    },
  ],
] as const;

describe.each(cases)("Neon WebSocket (%s)", (endpoint, makeDb) => {
  withNeonTestBranch({ endpoint });

  test("create table", async () => {
    const { end, sql } = makeDb(process.env.DATABASE_URL!);

    await sql(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE
      )
    `);

    const newUser = await sql(`
      INSERT INTO users (name)
      VALUES ('Ellen Ripley')
      RETURNING *
    `);
    expect(newUser.rows[0]).toStrictEqual({ id: 1, name: "Ellen Ripley" });

    const users = await sql(`SELECT * FROM users`);
    expect(users.rows).toStrictEqual([{ id: 1, name: "Ellen Ripley" }]);

    // 👎 Have to manually end the connection unless disabling `deleteBranch`
    await end();
  });

  test("tests are not isolated within a test file", async () => {
    const { end, sql } = makeDb(process.env.DATABASE_URL!);

    const newUser = await sql(`
      INSERT INTO users (name)
      VALUES ('Rebecca Jorden')
      RETURNING *
    `);
    expect(newUser.rows).toStrictEqual([{ id: 2, name: "Rebecca Jorden" }]);

    const users = await sql(`SELECT * FROM users`);
    expect(users.rows).toStrictEqual([
      // Ellen Ripley is already in the table from the previous test
      { id: 1, name: "Ellen Ripley" },
      { id: 2, name: "Rebecca Jorden" },
    ]);

    // 👎 Have to manually end the connection unless disabling `deleteBranch`
    await end();
  });

  test("interactive transactions are supported", async () => {
    const { end, sql } = makeDb(process.env.DATABASE_URL!);

    try {
      await sql("BEGIN");
      await sql(`INSERT INTO users (name) VALUES ('Private Vasquez')`);
      // Duplicate unique constraint error - will roll back the transaction
      await sql(`INSERT INTO users (name) VALUES ('Private Vasquez')`);
      await sql("COMMIT");
    } catch {
      await sql("ROLLBACK");
    }

    const users = await sql(`SELECT * FROM users`);
    expect(users.rows).toStrictEqual([
      { id: 1, name: "Ellen Ripley" },
      { id: 2, name: "Rebecca Jorden" },
      // Private Vasquez is not inserted because of the transaction rollback
    ]);

    // 👎 Have to manually end the connection unless disabling `deleteBranch`
    await end();
  });
});
