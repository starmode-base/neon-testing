/**
 * @neondatabase/serverless
 *
 * Protocol:                                  | HTTP
 * Driver:                                    | @neondatabase/serverless
 * ORM:                                       | drizzle-orm
 * Interactive transactions                   | ❌
 * Automatic connection lifecycle management  | ✅
 *
 * https://www.npmjs.com/package/@neondatabase/serverless
 * https://www.npmjs.com/package/drizzle-orm
 * https://orm.drizzle.team/docs/get-started/neon-new
 * https://orm.drizzle.team/docs/connect-neon
 */
import { describe, expect, test } from "vitest";
import { neonTesting } from "../neon-testing";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { lazySingleton } from "neon-testing/utils";

const cases = [
  ["pooler", (url: string) => drizzle(url)],
  ["direct", (url: string) => drizzle(url)],
  ["pooler", (url: string) => drizzle({ client: neon(url) })],
  ["direct", (url: string) => drizzle({ client: neon(url) })],
] as const;

describe.each(cases)("Drizzle Neon HTTP (%s)", (endpoint, makeDb) => {
  neonTesting({ endpoint });

  const db = lazySingleton(() => makeDb(process.env.DATABASE_URL!));

  test("create table", async () => {
    await db().execute(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE
      )
    `);

    const { rows: newUser } = await db().execute(`
      INSERT INTO users (name)
      VALUES ('Ellen Ripley')
      RETURNING *
    `);

    expect(newUser).toStrictEqual([{ id: 1, name: "Ellen Ripley" }]);

    const { rows: users } = await db().execute(`SELECT * FROM users`);
    expect(users).toStrictEqual([{ id: 1, name: "Ellen Ripley" }]);
  });

  test("tests are not isolated within a test file", async () => {
    const { rows: newUser } = await db().execute(`
      INSERT INTO users (name)
      VALUES ('Rebecca Jorden')
      RETURNING *
    `);
    expect(newUser).toStrictEqual([{ id: 2, name: "Rebecca Jorden" }]);

    const { rows: users } = await db().execute(`SELECT * FROM users`);
    expect(users).toStrictEqual([
      // Ellen Ripley is already in the table from the previous test
      { id: 1, name: "Ellen Ripley" },
      { id: 2, name: "Rebecca Jorden" },
    ]);
  });

  test("interactive transactions are NOT supported", async () => {
    try {
      await db().execute(`BEGIN`);
      await db().execute(`INSERT INTO users (name) VALUES ('Private Vasquez')`);
      // Duplicate unique constraint error - will fail but not roll back
      await db().execute(`INSERT INTO users (name) VALUES ('Private Vasquez')`);
      await db().execute(`COMMIT`);
    } catch {
      await db().execute(`ROLLBACK`);
    }

    const { rows: users } = await db().execute(`SELECT * FROM users`);
    expect(users).toStrictEqual([
      { id: 1, name: "Ellen Ripley" },
      { id: 2, name: "Rebecca Jorden" },
      // Private Vasquez is inserted despite the unique constraint error because
      // interactive transactions are not supported by this driver.
      { id: 3, name: "Private Vasquez" },
    ]);
  });
});
