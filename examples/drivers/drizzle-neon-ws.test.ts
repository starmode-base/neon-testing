/**
 * drizzle-orm/neon-serverless
 *
 * Supports interactive transactions
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
  withNeonTestBranch({ endpoint });

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

    await db.$client.end();
  });

  test("interactive transactions are supported", async () => {
    const db = drizzle(process.env.DATABASE_URL!);
    const client = await db.$client.connect();

    try {
      await db.execute("BEGIN");
      await db.execute(`INSERT INTO users (name) VALUES ('Private Vasquez')`);
      // Duplicate unique constraint error - will roll back the transaction
      await db.execute(`INSERT INTO users (name) VALUES ('Private Vasquez')`);
      await db.execute("COMMIT");
    } catch (error) {
      await db.execute("ROLLBACK");
    } finally {
      client.release();
    }

    const users = await db.execute(`SELECT * FROM users`);
    expect(users.rows).toStrictEqual([
      { id: 1, name: "Ellen Ripley" },
      { id: 2, name: "Rebecca Jorden" },
      // Private Vasquez is not inserted because of the transaction rollback
    ]);

    await db.$client.end();
  });
});
