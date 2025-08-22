/**
 * drizzle-orm/neon-serverless
 *
 * Supports interactive transactions
 *
 * https://www.npmjs.com/package/drizzle-orm
 * https://orm.drizzle.team/docs/get-started/neon-new
 * https://orm.drizzle.team/docs/connect-neon
 */
import { test } from "vitest";
import { withNeonTestBranch } from "../test-setup";
import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";

withNeonTestBranch({
  endpoint: "pooler",
  // endpoint: "direct",
});

// TODO: This does not work unless we disable the deleteBranch
// https://github.com/starmode-base/neon-testing/blob/bff84530ee75d0390d1497b190efdcff403cfdef/index.ts#L141-L142
test.skip("query", async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle({ client: pool });
  await db.execute(`SELECT 1`);
});
