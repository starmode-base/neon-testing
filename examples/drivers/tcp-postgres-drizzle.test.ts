/**
 * postgres (Postgres.js)
 *
 * Protocol:                                  | TCP
 * Driver:                                    | postgres
 * ORM:                                       | drizzle-orm
 * Interactive transactions                   | ✅
 * Automatic connection lifecycle management  | ✅
 *
 * https://www.npmjs.com/package/postgres
 * https://www.npmjs.com/package/drizzle-orm
 * https://orm.drizzle.team/docs/get-started-postgresql#postgresjs
 */
import { describe, expect, test } from "vitest";
import { withNeonTestBranch } from "../test-setup";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { lazySingleton } from "../../singleton";

const cases = [
  ["pooler", (url: string) => drizzle(url)],
  ["direct", (url: string) => drizzle(url)],
  ["pooler", (url: string) => drizzle({ client: postgres(url) })],
  ["direct", (url: string) => drizzle({ client: postgres(url) })],
] as const;

describe.each(cases)("Drizzle Postgres.js (%s)", (endpoint, makeDb) => {
  withNeonTestBranch({ endpoint });

  const db = lazySingleton(() => makeDb(process.env.DATABASE_URL!));

  test("create table", async () => {
    await db().execute(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE
      )
    `);

    const [newUser] = await db().execute(`
      INSERT INTO users (name)
      VALUES ('Ellen Ripley')
      RETURNING *
    `);
    expect(newUser).toStrictEqual({ id: 1, name: "Ellen Ripley" });

    const users = await db().execute(`SELECT * FROM users`);
    expect([...users]).toStrictEqual([{ id: 1, name: "Ellen Ripley" }]);
  });

  test("tests are not isolated within a test file", async () => {
    const newUser = await db().execute(`
      INSERT INTO users (name)
      VALUES ('Rebecca Jorden')
      RETURNING *
    `);
    expect([...newUser]).toStrictEqual([{ id: 2, name: "Rebecca Jorden" }]);

    const users = await db().execute(`SELECT * FROM users`);
    expect([...users]).toStrictEqual([
      // Ellen Ripley is already in the table from the previous test
      { id: 1, name: "Ellen Ripley" },
      { id: 2, name: "Rebecca Jorden" },
    ]);
  });

  test("interactive transactions are supported", async () => {
    try {
      await db().execute("BEGIN");
      await db().execute(`INSERT INTO users (name) VALUES ('Private Vasquez')`);
      // Duplicate unique constraint error - will roll back the transaction
      await db().execute(`INSERT INTO users (name) VALUES ('Private Vasquez')`);
      await db().execute("COMMIT");
    } catch {
      await db().execute("ROLLBACK");
    }

    const users = await db().execute(`SELECT * FROM users`);
    expect([...users]).toStrictEqual([
      { id: 1, name: "Ellen Ripley" },
      { id: 2, name: "Rebecca Jorden" },
      // Private Vasquez is not inserted because of the transaction rollback
    ]);
  });
});
