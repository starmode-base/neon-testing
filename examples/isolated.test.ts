/**
 * To isolate tests within a file, reset the Neon branch before each test
 *
 * This file contains a few ways to isolate tests within a file
 */
import { describe, beforeEach, expect, test } from "vitest";
import { neonTesting } from "./test-setup";
import { neon } from "@neondatabase/serverless";

neonTesting();

/**
 * Drop the Postgres schema before each test
 *
 * When you drop the schema you have to re-apply the database migrations/schema
 * before each test
 */
describe("isolate tests by dropping schema", () => {
  beforeEach(async () => {
    const sql = neon(process.env.DATABASE_URL!);
    await sql`DROP SCHEMA IF EXISTS public CASCADE`;
    await sql`CREATE SCHEMA public`;
    await sql`CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT)`;
  });

  /**
   * This test is run twice and would fail if the database is shared between
   * tests
   */
  test.each([0, 1])("individual tests are isolated - %s", async () => {
    const sql = neon(process.env.DATABASE_URL!);

    expect(await sql`SELECT * FROM users`).toStrictEqual([]);

    await sql`INSERT INTO users (name) VALUES ('Ellen Ripley')`;

    expect(await sql`SELECT * FROM users`).toStrictEqual([
      { id: 1, name: "Ellen Ripley" },
    ]);
  });
});

/**
 * Drop the table before each test
 *
 * When you drop tables you have to re-apply the database migrations/schema
 * before each test
 */
describe("isolate tests by dropping tables", () => {
  beforeEach(async () => {
    const sql = neon(process.env.DATABASE_URL!);

    await sql`DROP TABLE IF EXISTS users`;
    await sql`CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT)`;

    await sql`DELETE FROM users`;
  });

  /**
   * This test is run twice and would fail if the database is shared between
   * tests
   */
  test.each([0, 1])("individual tests are isolated - %s", async () => {
    const sql = neon(process.env.DATABASE_URL!);

    expect(await sql`SELECT * FROM users`).toStrictEqual([]);

    await sql`INSERT INTO users (name) VALUES ('Ellen Ripley')`;

    expect(await sql`SELECT * FROM users`).toStrictEqual([
      { id: 1, name: "Ellen Ripley" },
    ]);
  });
});

/**
 * Delete table rows before each test
 *
 * When you delete rows, the tables themselves are intact so there is no need to
 * re-apply the database migrations/schema
 */
describe("isolate tests by deleting rows", () => {
  beforeEach(async () => {
    const sql = neon(process.env.DATABASE_URL!);
    await sql`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, name TEXT)`;
    await sql`DELETE FROM users`;
    await sql`ALTER SEQUENCE users_id_seq RESTART WITH 1`;
  });

  /**
   * This test is run twice and would fail if the database is shared between
   * tests
   */
  test.each([0, 1])("individual tests are isolated - %s", async () => {
    const sql = neon(process.env.DATABASE_URL!);

    expect(await sql`SELECT * FROM users`).toStrictEqual([]);

    await sql`INSERT INTO users (name) VALUES ('Ellen Ripley')`;

    expect(await sql`SELECT * FROM users`).toStrictEqual([
      { id: 1, name: "Ellen Ripley" },
    ]);
  });
});

/**
 * Truncate tables before each test
 *
 * When you truncate tables, the tables themselves are intact so there is no
 * need to re-apply the database migrations/schema
 */
describe("isolate tests by truncating tables", () => {
  beforeEach(async () => {
    const sql = neon(process.env.DATABASE_URL!);
    await sql`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, name TEXT)`;
    await sql`TRUNCATE TABLE users`;
    await sql`ALTER SEQUENCE users_id_seq RESTART WITH 1`;
  });

  /**
   * This test is run twice and would fail if the database is shared between
   * tests
   */
  test.each([0, 1])("individual tests are isolated - %s", async () => {
    const sql = neon(process.env.DATABASE_URL!);

    expect(await sql`SELECT * FROM users`).toStrictEqual([]);

    await sql`INSERT INTO users (name) VALUES ('Ellen Ripley')`;

    expect(await sql`SELECT * FROM users`).toStrictEqual([
      { id: 1, name: "Ellen Ripley" },
    ]);
  });
});
