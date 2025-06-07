/**
 * @neondatabase/serverless
 *
 * https://www.npmjs.com/package/@neondatabase/serverless
 */
import { beforeEach, expect, test } from "vitest";
import { withNeonTestDatabase } from "./test-helpers";
import { neon } from "@neondatabase/serverless";

/**
 * Enable Neon database testing environment
 *
 * - Creates an isolated Neon branch for each test file
 * - Tests within a file are not isolated, they share the same branch instance
 * - The branch is deleted when all tests in the file have completed
 */
withNeonTestDatabase();

/**
 * To isolate tests within a file, reset the Neon branch before each test
 */
beforeEach(async () => {
  const sql = neon(process.env.DATABASE_URL!);

  await sql`DROP SCHEMA IF EXISTS public CASCADE`;
  await sql`CREATE SCHEMA public`;

  await sql`
    CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL
    )
  `;

  await sql`DELETE FROM users`;
});

test("Neon serverless driver", async () => {
  const sql = neon(process.env.DATABASE_URL!);

  const [newUser] = await sql`
    INSERT INTO users (name)
    VALUES ('Ellen Ripley')
    RETURNING *
  `;
  expect(newUser).toStrictEqual({ id: 1, name: "Ellen Ripley" });

  const users = await sql`SELECT * FROM users`;
  expect(users).toStrictEqual([{ id: 1, name: "Ellen Ripley" }]);
});

test("Neon serverless driver with transaction", async () => {
  const sql = neon(process.env.DATABASE_URL!);

  await sql.transaction((tx) => [
    tx`
      INSERT INTO users (name)
      VALUES ('Rebecca Jorden')
    `,
  ]);

  const users = await sql`SELECT * FROM users`;
  expect(users).toStrictEqual([{ id: 1, name: "Rebecca Jorden" }]);
});
