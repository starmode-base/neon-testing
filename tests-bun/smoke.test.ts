import { expect, test, neonTesting } from "./neon-testing";
import { Pool } from "@neondatabase/serverless";

neonTesting();

test("creates a branch and exposes a working DATABASE_URL", async () => {
  expect(process.env.DATABASE_URL).toBeDefined();

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const result = await pool.query("SELECT 1 AS value");
  expect(result.rows[0].value).toBe(1);
  await pool.end();
});
