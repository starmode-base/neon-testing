/**
 * Synchronization barriers: inline demonstration
 *
 * Each test progressively demonstrates how barriers expose race conditions
 * and verify that locks prevent them. The `credit` function is redefined in
 * each test with the barrier baked in, matching the blog post's narrative.
 *
 * Blog post: https://www.lirbank.com/harnessing-postgres-race-conditions
 */
import { beforeEach, expect, test } from "vitest";
import { Pool, type PoolClient } from "@neondatabase/serverless";
import { neonTesting } from "../neon-testing";
import { createBarrier } from "neon-testing/utils";

/**
 * Each test file gets an isolated Neon branch
 */
neonTesting({
  autoCloseWebSockets: true,
});

/**
 * Get a client for the database
 */
const getClient = () =>
  new Pool({ connectionString: process.env.DATABASE_URL }).connect();

/**
 * Reset the accounts table before each test
 */
beforeEach(async () => {
  const client = await getClient();

  await client.query("DROP TABLE IF EXISTS accounts");
  await client.query(
    "CREATE TABLE accounts (id SERIAL PRIMARY KEY, balance INTEGER)",
  );
  await client.query("INSERT INTO accounts (id, balance) VALUES (1, 100)");
});

type Account = {
  id: number;
  balance: number;
};

/**
 * Get the balance of an account
 */
async function getBalanceById(accountId: number) {
  const client = await getClient();

  const { rows } = await client.query<Account>(
    "SELECT balance FROM accounts WHERE id = $1",
    [accountId],
  );

  return rows[0]?.balance ?? null;
}

/**
 * 1. Bare queries with barrier
 *
 * Two concurrent credits each SELECT the balance (100), add 50, and UPDATE.
 * Without a transaction or lock, both write 150 — one credit is silently lost.
 */
test("❌ 1. Bare queries with barrier", async () => {
  const barrier = createBarrier(2);

  // Bare SELECT and UPDATE — no transaction, no lock
  const credit = async (accountId: number, amount: number) => {
    const client = await getClient();

    const result = await client.query<Account>(
      "SELECT balance FROM accounts WHERE id = $1",
      [accountId],
    );

    await barrier();

    const newBalance = result.rows[0]!.balance + amount;
    await client.query("UPDATE accounts SET balance = $1 WHERE id = $2", [
      newBalance,
      accountId,
    ]);
  };

  // Run two credits at the same time
  await Promise.all([credit(1, 50), credit(1, 50)]);

  // ❌ Should be 200 with proper isolation
  expect(await getBalanceById(1)).toBe(150);
});

/**
 * 2. Transactions with barrier
 *
 * Wrapping in BEGIN/COMMIT doesn't help. Under READ COMMITTED isolation,
 * both transactions still read the same stale balance before either writes.
 */
test("❌ 2. With transactions and barrier", async () => {
  const barrier = createBarrier(2);

  // Same as test 1, plus: BEGIN/COMMIT
  const credit = async (accountId: number, amount: number) => {
    const client = await getClient();

    await client.query("BEGIN");

    const result = await client.query<Account>(
      "SELECT balance FROM accounts WHERE id = $1",
      [accountId],
    );

    await barrier();

    const newBalance = result.rows[0]!.balance + amount;
    await client.query("UPDATE accounts SET balance = $1 WHERE id = $2", [
      newBalance,
      accountId,
    ]);

    await client.query("COMMIT");
  };

  // Run two credits at the same time
  await Promise.all([credit(1, 50), credit(1, 50)]);

  // ❌ Should be 200 with proper isolation
  expect(await getBalanceById(1)).toBe(150);
});

/**
 * 3. FOR UPDATE — barrier between read and write (deadlock)
 *
 * Adding FOR UPDATE acquires a row lock on SELECT. But with the barrier
 * after the lock, T1 holds the lock and waits for T2 — which is blocked
 * trying to acquire the same lock. Neither can proceed: deadlock.
 */
test("❌ 3. With write lock and barrier (deadlock)", async () => {
  const barrier = createBarrier(2);
  const clients: PoolClient[] = [];

  // Same as test 2, plus: FOR UPDATE
  const credit = async (accountId: number, amount: number) => {
    const client = await getClient();
    clients.push(client); // track for cleanup after deadlock

    await client.query("BEGIN");

    const result = await client.query<Account>(
      "SELECT balance FROM accounts WHERE id = $1 FOR UPDATE",
      [accountId],
    );

    await barrier();

    const newBalance = result.rows[0]!.balance + amount;
    await client.query("UPDATE accounts SET balance = $1 WHERE id = $2", [
      newBalance,
      accountId,
    ]);

    await client.query("COMMIT");
  };

  // Run two credits at the same time (and wait for the deadlock)
  const result = await Promise.race([
    Promise.all([credit(1, 50), credit(1, 50)]).then(
      () => "completed" as const,
    ),
    new Promise<"deadlock">((resolve) =>
      setTimeout(() => resolve("deadlock"), 1000),
    ),
  ]);

  // Terminate the stuck connections so subsequent tests can DROP TABLE
  clients.forEach((c) => c.release(true));

  // ❌ Should be "deadlock"
  expect(result).toBe("deadlock");
});

/**
 * 4. FOR UPDATE — barrier before SELECT (the solution)
 *
 * Moving the barrier before the locked SELECT lets both transactions enter
 * the critical section concurrently. FOR UPDATE then serializes them: T1
 * locks the row, T2 waits, and reads the updated value after T1 commits.
 */
test("✅ 4. With write lock and barrier (barrier in correct position)", async () => {
  const barrier = createBarrier(2);

  // Same as test 3, but: barrier moved before SELECT
  const credit = async (accountId: number, amount: number) => {
    const client = await getClient();

    await client.query("BEGIN");

    await barrier();

    const result = await client.query<Account>(
      "SELECT balance FROM accounts WHERE id = $1 FOR UPDATE",
      [accountId],
    );

    const newBalance = result.rows[0]!.balance + amount;
    await client.query("UPDATE accounts SET balance = $1 WHERE id = $2", [
      newBalance,
      accountId,
    ]);

    await client.query("COMMIT");
  };

  // Run two credits at the same time
  await Promise.all([credit(1, 50), credit(1, 50)]);

  // ✅ Should be 200 with proper isolation
  expect(await getBalanceById(1)).toBe(200);
});

/**
 * 5. Proof: without FOR UPDATE the barrier alone changes nothing
 *
 * Same barrier position as test 4 but without FOR UPDATE. Both transactions
 * read the stale balance concurrently — proving it's the lock, not the
 * barrier placement, that prevents the lost update.
 */
test("❌ 5. Without write lock and barrier (proof)", async () => {
  const barrier = createBarrier(2);

  // Same as test 4, minus: FOR UPDATE
  const credit = async (accountId: number, amount: number) => {
    const client = await getClient();

    await client.query("BEGIN");

    await barrier();

    const result = await client.query<Account>(
      "SELECT balance FROM accounts WHERE id = $1",
      [accountId],
    );

    const newBalance = result.rows[0]!.balance + amount;
    await client.query("UPDATE accounts SET balance = $1 WHERE id = $2", [
      newBalance,
      accountId,
    ]);

    await client.query("COMMIT");
  };

  // Run two credits at the same time
  await Promise.all([credit(1, 50), credit(1, 50)]);

  // ❌ Should be 200 with proper isolation
  expect(await getBalanceById(1)).toBe(150);
});
