import { describe, expect, test } from "vitest";
import { neonTesting } from "./neon-testing";
import { neon } from "@neondatabase/serverless";
import invariant from "tiny-invariant";

describe("Schema-only branch creation", () => {
  const getBranch = neonTesting({ schemaOnly: true });

  test("creates a schema-only branch successfully", () => {
    const branch = getBranch();
    invariant(branch, "Branch not found");

    expect(branch.id).toBeDefined();
    expect(branch.name).toMatch(/^test\//);
  });

  test("schema-only branch is connectable", async () => {
    const sql = neon(process.env.DATABASE_URL!);
    const result = await sql`SELECT 1 as ok`;
    expect(result).toStrictEqual([{ ok: 1 }]);
  });
});
