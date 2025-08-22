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

withNeonTestBranch({
  endpoint: "pooler",
  // endpoint: "direct",
});

// TODO: This does not work unless we disable the deleteBranch
// https://github.com/starmode-base/neon-testing/blob/25712933772ee923ceaa7b4462c8b1b3288c0703/index.ts#L141
test.skip("query", async () => {
  const db = drizzle(process.env.DATABASE_URL!);
  await db.execute(`SELECT 1`);
});
