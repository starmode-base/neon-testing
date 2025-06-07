/**
 * @neondatabase/serverless
 *
 * https://www.npmjs.com/package/@neondatabase/serverless
 */
import { expect, test } from "vitest";
import { withNeonTestBranch } from "./test-helpers";
import { neon } from "@neondatabase/serverless";

/**
 * Enable Neon database testing environment
 *
 * - Creates an isolated Neon branch for each test file
 * - Tests within a file are not isolated, they share the same branch instance
 * - The branch is deleted when all tests in the file have completed
 */
withNeonTestBranch();

test("Neon serverless driver", async () => {
  const sql = neon(process.env.DATABASE_URL!);

  await sql`
    CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL
    )
  `;

  const [newUser] = await sql`
    INSERT INTO users (name)
    VALUES ('Ellen Ripley')
    RETURNING *
  `;
  expect(newUser).toStrictEqual({ id: 1, name: "Ellen Ripley" });

  const users = await sql`SELECT * FROM users`;
  expect(users).toStrictEqual([{ id: 1, name: "Ellen Ripley" }]);
});

test("Neon serverless driver with transactions", async () => {
  const sql = neon(process.env.DATABASE_URL!);

  await sql.transaction((tx) => [
    tx`
      INSERT INTO users (name)
      VALUES ('Rebecca Jorden')
    `,
  ]);

  const users = await sql`SELECT * FROM users`;
  expect(users).toStrictEqual([
    // Note the same Neon branch is used for all tests in the same file, clean
    // it up manually if you want a clean slate for each test.
    { id: 1, name: "Ellen Ripley" },
    { id: 2, name: "Rebecca Jorden" },
  ]);
});
