/**
 * @neondatabase/serverless
 *
 * Protocol:                                  | HTTP
 * Driver:                                    | @neondatabase/serverless
 * ORM:                                       | -
 * Interactive transactions                   | ❌
 * Automatic connection lifecycle management  | ✅
 *
 * https://www.npmjs.com/package/@neondatabase/serverless
 */
import { describe, expect, test } from "vitest";
import { withNeonTestBranch } from "../test-setup";
import { neon } from "@neondatabase/serverless";

const endpoints = ["pooler", "direct"] as const;

describe.each(endpoints)("Neon serverless http (%s)", (endpoint) => {
  withNeonTestBranch({ endpoint });

  test("create table", async () => {
    const sql = neon(process.env.DATABASE_URL!);

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
    expect(newUser).toStrictEqual([{ id: 1, name: "Ellen Ripley" }]);

    const users = await sql`SELECT * FROM users`;
    expect(users).toStrictEqual([{ id: 1, name: "Ellen Ripley" }]);
  });

  test("tests are not isolated", async () => {
    const sql = neon(process.env.DATABASE_URL!);

    const newUser = await sql`
      INSERT INTO users (name)
      VALUES ('Rebecca Jorden')
      RETURNING *
    `;
    expect(newUser).toStrictEqual([{ id: 2, name: "Rebecca Jorden" }]);

    const users = await sql`SELECT * FROM users`;
    expect(users).toStrictEqual([
      // Ellen Ripley is already in the table from the previous test
      { id: 1, name: "Ellen Ripley" },
      { id: 2, name: "Rebecca Jorden" },
    ]);
  });

  test("interactive transactions are NOT supported", async () => {
    const sql = neon(process.env.DATABASE_URL!);

    try {
      await sql`BEGIN`;
      await sql`INSERT INTO users (name) VALUES ('Private Vasquez')`;
      // Duplicate unique constraint error - will fail but not roll back
      await sql`INSERT INTO users (name) VALUES ('Private Vasquez')`;
      await sql`COMMIT`;
    } catch {
      await sql`ROLLBACK`;
    }

    const users = await sql`SELECT * FROM users`;
    expect(users).toStrictEqual([
      { id: 1, name: "Ellen Ripley" },
      { id: 2, name: "Rebecca Jorden" },
      // Private Vasquez is inserted despite the unique constraint error because
      // interactive transactions are not supported by this driver.
      { id: 3, name: "Private Vasquez" },
    ]);
  });
});
