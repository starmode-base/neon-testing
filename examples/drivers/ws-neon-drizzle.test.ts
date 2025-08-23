/**
 * drizzle-orm/neon-serverless
 *
 * Protocol:                                  | WebSocket
 * Driver:                                    | drizzle-orm/neon-serverless
 * ORM:                                       | drizzle-orm
 * Interactive transactions                   | ✅
 * Automatic connection lifecycle management  | ❌
 *
 * https://www.npmjs.com/package/drizzle-orm
 * https://orm.drizzle.team/docs/get-started/neon-new
 * https://orm.drizzle.team/docs/connect-neon
 */
import { describe, expect, test } from "vitest";
import { withNeonTestBranch } from "../test-setup";
import { drizzle } from "drizzle-orm/neon-serverless";

const endpoints = ["pooler", "direct"] as const;

describe.each(endpoints)("Neon serverless websockets (%s)", (endpoint) => {
  withNeonTestBranch({ endpoint, deleteBranch: true });

  test("create table", async () => {
    const db = drizzle(process.env.DATABASE_URL!);

    await db.execute(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE
      )
    `);

    const newUser = await db.execute(`
      INSERT INTO users (name)
      VALUES ('Ellen Ripley')
      RETURNING *
    `);
    expect(newUser.rows[0]).toStrictEqual({ id: 1, name: "Ellen Ripley" });

    const users = await db.execute(`SELECT * FROM users`);
    expect(users.rows).toStrictEqual([{ id: 1, name: "Ellen Ripley" }]);

    // 👎 Have to manually end the connection unless disabling `deleteBranch`
    await db.$client.end();
  });

  test("tests are not isolated", async () => {
    const db = drizzle(process.env.DATABASE_URL!);

    const newUser = await db.execute(`
      INSERT INTO users (name)
      VALUES ('Rebecca Jorden')
      RETURNING *
    `);
    expect(newUser.rows).toStrictEqual([{ id: 2, name: "Rebecca Jorden" }]);

    const users = await db.execute(`SELECT * FROM users`);
    expect(users.rows).toStrictEqual([
      // Ellen Ripley is already in the table from the previous test
      { id: 1, name: "Ellen Ripley" },
      { id: 2, name: "Rebecca Jorden" },
    ]);

    // 👎 Have to manually end the connection unless disabling `deleteBranch`
    await db.$client.end();
  });

  test("interactive transactions are supported", async () => {
    const db = drizzle(process.env.DATABASE_URL!);

    try {
      await db.execute("BEGIN");
      await db.execute(`INSERT INTO users (name) VALUES ('Private Vasquez')`);
      // Duplicate unique constraint error - will roll back the transaction
      await db.execute(`INSERT INTO users (name) VALUES ('Private Vasquez')`);
      await db.execute("COMMIT");
    } catch {
      await db.execute("ROLLBACK");
    }

    const users = await db.execute(`SELECT * FROM users`);
    expect(users.rows).toStrictEqual([
      { id: 1, name: "Ellen Ripley" },
      { id: 2, name: "Rebecca Jorden" },
      // Private Vasquez is not inserted because of the transaction rollback
    ]);

    // 👎 Have to manually end the connection unless disabling `deleteBranch`
    await db.$client.end();
  });
});
