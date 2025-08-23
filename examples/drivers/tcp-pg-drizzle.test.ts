/**
 * pg (node-postgres)
 *
 * Protocol:                                  | TCP
 * Driver:                                    | pg
 * ORM:                                       | drizzle-orm
 * Interactive transactions                   | ✅
 * Automatic connection lifecycle management  | ❌
 *
 * https://www.npmjs.com/package/pg
 * https://www.npmjs.com/package/drizzle-orm
 * https://orm.drizzle.team/docs/get-started-postgresql#postgresjs
 */
import { describe, expect, test } from "vitest";
import { withNeonTestBranch } from "../test-setup";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

const cases = [
  ["pooler", (url: string) => drizzle(url)],
  ["direct", (url: string) => drizzle(url)],
  [
    "pooler",
    (url: string) => drizzle({ client: new Pool({ connectionString: url }) }),
  ],
  [
    "direct",
    (url: string) => drizzle({ client: new Pool({ connectionString: url }) }),
  ],
] as const;

describe.each(cases)("node-postgres (%s)", (endpoint, makeDb) => {
  withNeonTestBranch({ endpoint });

  test("create table", async () => {
    const pool = makeDb(process.env.DATABASE_URL!);

    await pool.execute(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE
      )
    `);

    const newUser = await pool.execute(`
      INSERT INTO users (name)
      VALUES ('Ellen Ripley')
      RETURNING *
    `);
    expect(newUser.rows[0]).toStrictEqual({ id: 1, name: "Ellen Ripley" });

    const users = await pool.execute(`SELECT * FROM users`);
    expect(users.rows).toStrictEqual([{ id: 1, name: "Ellen Ripley" }]);

    // 👎 Have to manually end the connection unless disabling `deleteBranch`
    await pool.$client.end();
  });

  test("tests are not isolated within a test file", async () => {
    const pool = makeDb(process.env.DATABASE_URL!);

    const newUser = await pool.execute(`
      INSERT INTO users (name)
      VALUES ('Rebecca Jorden')
      RETURNING *
    `);
    expect(newUser.rows).toStrictEqual([{ id: 2, name: "Rebecca Jorden" }]);

    const users = await pool.execute(`SELECT * FROM users`);
    expect(users.rows).toStrictEqual([
      // Ellen Ripley is already in the table from the previous test
      { id: 1, name: "Ellen Ripley" },
      { id: 2, name: "Rebecca Jorden" },
    ]);

    // 👎 Have to manually end the connection unless disabling `deleteBranch`
    await pool.$client.end();
  });

  test("interactive transactions are supported", async () => {
    const pool = makeDb(process.env.DATABASE_URL!);

    try {
      await pool.execute("BEGIN");
      await pool.execute(`INSERT INTO users (name) VALUES ('Private Vasquez')`);
      // Duplicate unique constraint error - will roll back the transaction
      await pool.execute(`INSERT INTO users (name) VALUES ('Private Vasquez')`);
      await pool.execute("COMMIT");
    } catch {
      await pool.execute("ROLLBACK");
    }

    const users = await pool.execute(`SELECT * FROM users`);
    expect(users.rows).toStrictEqual([
      { id: 1, name: "Ellen Ripley" },
      { id: 2, name: "Rebecca Jorden" },
      // Private Vasquez is not inserted because of the transaction rollback
    ]);

    // 👎 Have to manually end the connection unless disabling `deleteBranch`
    await pool.$client.end();
  });
});
