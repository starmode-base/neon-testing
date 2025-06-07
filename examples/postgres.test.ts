/**
 * Postgres.js
 *
 * https://www.npmjs.com/package/postgres
 */
import { expect, test } from "vitest";
import { withNeonTestDatabase } from "./test-helpers";
import postgres from "postgres";

/**
 * Enable Neon database testing environment
 *
 * - Creates an isolated Neon branch for each test file
 * - Tests within a file are not isolated, they share the same branch instance
 * - The branch is deleted when all tests in the file have completed
 */
withNeonTestDatabase();

test("Postgres.js driver", async () => {
  const sql = postgres(process.env.DATABASE_URL!);

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
  expect([...users]).toStrictEqual([{ id: 1, name: "Ellen Ripley" }]);
});

test("Postgres.js driver with transactions", async () => {
  const sql = postgres(process.env.DATABASE_URL!);

  await sql.begin((tx) => [
    tx`
      INSERT INTO users (name)
      VALUES ('Rebecca Jorden')
    `,
  ]);

  const users = await sql`SELECT * FROM users`;
  expect([...users]).toStrictEqual([
    // Note the same Neon branch is used for all tests in the same file, clean
    // it up manually if you want a clean slate for each test.
    { id: 1, name: "Ellen Ripley" },
    { id: 2, name: "Rebecca Jorden" },
  ]);
});
