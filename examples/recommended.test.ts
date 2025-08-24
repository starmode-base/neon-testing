// recommended.test.ts
import { expect, test } from "vitest";
import { withNeonTestBranch } from "./test-setup";
import { Pool } from "@neondatabase/serverless";

// Enable Neon test branch for this test file
withNeonTestBranch({
  // Recommended for Neon WebSocket drivers to automatically close connections
  autoCloseWebSockets: true,
});

test("database operations", async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  await pool.query(`CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT)`);
  await pool.query(`INSERT INTO users (name) VALUES ('Ellen Ripley')`);

  const users = await pool.query(`SELECT * FROM users`);
  expect(users.rows).toStrictEqual([{ id: 1, name: "Ellen Ripley" }]);
});
