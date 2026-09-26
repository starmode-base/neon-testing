/**
 * Options that shape the connection URI: `endpoint` (pooler vs direct) and
 * `sslMode`.
 *
 * Connecting as a non-owner role (`roleName`) is not covered here because it
 * requires a parent branch with a pre-provisioned role.
 */
import { describe, expect, test } from "vitest";
import { neonTesting } from "./neon-testing";
import { Pool } from "@neondatabase/serverless";
import pg from "pg";

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

describe("sslMode: `default`", () => {
  neonTesting();

  test("leaves sslmode untouched and connects via pg", async () => {
    const url = new URL(process.env.DATABASE_URL!);
    // console.log(url.searchParams.entries());
    expect(url.searchParams.get("channel_binding")).toBe("require");
    expect(url.searchParams.get("sslmode")).toBe("require");
    expect(url.searchParams.get("uselibpqcompat")).toBeNull();

    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    const result = await pool.query("SELECT 1 as test");
    expect(result.rows[0].test).toBe(1);
    await pool.end();
  });
});

describe("sslMode: verify-full", () => {
  neonTesting({ sslMode: "verify-full" });

  test("rewrites sslmode and connects via pg", async () => {
    const url = new URL(process.env.DATABASE_URL!);
    // console.log(url.searchParams.entries());
    expect(url.searchParams.get("channel_binding")).toBe("require");
    expect(url.searchParams.get("sslmode")).toBe("verify-full");
    expect(url.searchParams.get("uselibpqcompat")).toBeNull();

    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    const result = await pool.query("SELECT 1 as test");
    expect(result.rows[0].test).toBe(1);
    await pool.end();
  });
});

describe("sslMode: require", () => {
  neonTesting({ sslMode: "require" });

  test("sets uselibpqcompat and connects via pg", async () => {
    const url = new URL(process.env.DATABASE_URL!);
    // console.log(url.searchParams.entries());
    expect(url.searchParams.get("channel_binding")).toBe("require");
    expect(url.searchParams.get("sslmode")).toBe("require");
    expect(url.searchParams.get("uselibpqcompat")).toBe("true");

    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    const result = await pool.query("SELECT 1 as test");
    expect(result.rows[0].test).toBe(1);
    await pool.end();
  });
});
