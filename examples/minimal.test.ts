// minimal.test.ts
import { expect, test } from "vitest";
import { makeNeonTesting } from "neon-testing";
import { Pool } from "@neondatabase/serverless";

// Enable Neon test branch for this test file
makeNeonTesting({
  apiKey: process.env.NEON_API_KEY!,
  projectId: process.env.NEON_PROJECT_ID!,
  // Recommended for Neon WebSocket drivers to automatically close connections
  autoCloseWebSockets: true,
})();

test("database operations", async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  await pool.query(`CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT)`);
  await pool.query(`INSERT INTO users (name) VALUES ('Ellen Ripley')`);

  const users = await pool.query(`SELECT * FROM users`);
  expect(users.rows).toStrictEqual([{ id: 1, name: "Ellen Ripley" }]);
});
