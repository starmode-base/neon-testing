import { describe, expect, test } from "vitest";
import { neonTesting } from "./neon-testing";
import { neon } from "@neondatabase/serverless";

describe("getConnectionUri API", () => {
  neonTesting({ autoCloseWebSockets: true });

  test("connects with default role", async () => {
    const sql = neon(process.env.DATABASE_URL!);

    const result = await sql`SELECT current_user as role`;
    expect(result[0].role).toBeDefined();
    expect(typeof result[0].role).toBe("string");
  });
});

describe("endpoint: pooler", () => {
  neonTesting({ endpoint: "pooler", autoCloseWebSockets: true });

  test("uses pooled connection URI", async () => {
    expect(process.env.DATABASE_URL).toContain("-pooler");

    const sql = neon(process.env.DATABASE_URL!);
    const result = await sql`SELECT 1 as test`;
    expect(result[0].test).toBe(1);
  });
});

describe("endpoint: direct", () => {
  neonTesting({ endpoint: "direct", autoCloseWebSockets: true });

  test("uses direct connection URI", async () => {
    expect(process.env.DATABASE_URL).not.toContain("-pooler");

    const sql = neon(process.env.DATABASE_URL!);
    const result = await sql`SELECT 1 as test`;
    expect(result[0].test).toBe(1);
  });
});
