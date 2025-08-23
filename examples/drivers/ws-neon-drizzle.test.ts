/**
 * @neondatabase/serverless
 *
 * Protocol:                                  | WebSocket
 * Driver:                                    | @neondatabase/serverless
 * ORM:                                       | drizzle-orm
 * Interactive transactions                   | ✅
 * Automatic connection lifecycle management  | ⚠️ with `autoCloseWebSockets` flag
 *
 * https://www.npmjs.com/package/@neondatabase/serverless
 * https://www.npmjs.com/package/drizzle-orm
 * https://orm.drizzle.team/docs/get-started/neon-new
 * https://orm.drizzle.team/docs/connect-neon
 */
import { describe, expect, test } from "vitest";
import { withNeonTestBranch } from "../test-setup";
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";

const cases = [
  [
    "pooler",
    (url: string) => {
      const db = drizzle(url);
      return {
        sql: (query: string) => db.execute(query),
        end: () => db.$client.end(),
      };
    },
  ],
  [
    "direct",
    (url: string) => {
      const db = drizzle(url);
      return {
        sql: (query: string) => db.execute(query),
        end: () => db.$client.end(),
      };
    },
  ],
  [
    "pooler",
    (url: string) => {
      const db = drizzle({ client: new Pool({ connectionString: url }) });
      return {
        sql: (query: string) => db.execute(query),
        end: () => db.$client.end(),
      };
    },
  ],
  [
    "direct",
    (url: string) => {
      const db = drizzle({ client: new Pool({ connectionString: url }) });
      return {
        sql: (query: string) => db.execute(query),
        end: () => db.$client.end(),
      };
    },
  ],
] as const;

describe.each(cases)("Drizzle Neon WebSocket (%s)", (endpoint, makeDb) => {
  withNeonTestBranch({
    endpoint,
    // deleteBranch: false,
    autoCloseWebSockets: true,
  });

  test("create table", async () => {
    const { sql } = makeDb(process.env.DATABASE_URL!);

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
  });

  test("tests are not isolated within a test file", async () => {
    const { sql } = makeDb(process.env.DATABASE_URL!);

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
  });

  test("interactive transactions are supported", async () => {
    const { sql } = makeDb(process.env.DATABASE_URL!);

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
  });
});
