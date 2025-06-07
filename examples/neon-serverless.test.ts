import { expect, test } from "vitest";
import { withNeonTestDatabase } from "./test-helpers";
import { neon } from "@neondatabase/serverless";

/**
 * Enable Neon testing
 *
 * - Each test file will have a separate Neon branch.
 * - The Neon branch will be deleted after all tests in the file have run.
 * - Tests within the same file will share the same Neon branch.
 */
withNeonTestDatabase();

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
