/**
 * Tests for the connection URI generation logic.
 *
 * Note: These tests primarily validate the `endpoint` option (pooler vs direct).
 * Custom role selection (`roleName` option) is not explicitly tested here as it
 * requires a parent branch with pre-provisioned additional roles.
 */
import { describe, expect, test } from "vitest";
import { neonTesting } from "./neon-testing";
import { Pool } from "@neondatabase/serverless";

describe("getConnectionUri API", () => {
  neonTesting({ autoCloseWebSockets: true });

  test("connects with default role", async () => {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const result = await pool.query("SELECT current_user as role");

    expect(result.rows[0].role).toBeDefined();
    expect(typeof result.rows[0].role).toBe("string");
    await pool.end();
  });
});

describe("endpoint: pooler", () => {
  neonTesting({ endpoint: "pooler", autoCloseWebSockets: true });

  test("uses pooled connection URI", async () => {
    expect(process.env.DATABASE_URL).toContain("-pooler");

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const result = await pool.query("SELECT 1 as test");
    expect(result.rows[0].test).toBe(1);
    await pool.end();
  });
});

describe("endpoint: direct", () => {
  neonTesting({ endpoint: "direct", autoCloseWebSockets: true });

  test("uses direct connection URI", async () => {
    expect(process.env.DATABASE_URL).not.toContain("-pooler");

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const result = await pool.query("SELECT 1 as test");
    expect(result.rows[0].test).toBe(1);
    await pool.end();
  });
});
