/**
 * postgres (Postgres.js)
 *
 * Protocol:                                  | TCP
 * Driver:                                    | postgres
 * ORM:                                       | -
 * Interactive transactions                   | ✅
 * Automatic connection lifecycle management  | ✅
 *
 * https://www.npmjs.com/package/postgres
 */
import { describe, expect, test } from "vitest";
import { withNeonTestBranch } from "../test-setup";
import postgres from "postgres";

const endpoints = ["pooler", "direct"] as const;

describe.each(endpoints)("Postgres.js driver (%s)", (endpoint) => {
  withNeonTestBranch({ endpoint });

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
    } catch {
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
