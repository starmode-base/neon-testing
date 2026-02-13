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
 */
test("❌ 1. Bare queries with barrier", async () => {
  const barrier = createBarrier(2);

  const credit = async (accountId: number, amount: number) => {
    const client = await getClient();

    const result = await client.query<Account>(
      "SELECT balance FROM accounts WHERE id = $1",
      [accountId],
    );

    // Synchronization barrier between read and write
    await barrier();

    const newBalance = result.rows[0]!.balance + amount;
    await client.query("UPDATE accounts SET balance = $1 WHERE id = $2", [
      newBalance,
      accountId,
    ]);
  };

  // Run two $50 credits at the same time
  await Promise.all([credit(1, 50), credit(1, 50)]);

  // Race condition: both tasks read 100, both compute 150, both write 150.
  // One $50 credit is silently lost.
  expect(await getBalanceById(1)).toBe(150); // ❌ Should be 200 with proper isolation
});

/**
 * 2. Transactions with barrier
 */
test("❌ 2. With transactions and barrier", async () => {
  const barrier = createBarrier(2);

  const credit = async (accountId: number, amount: number) => {
    const client = await getClient();

    await client.query("BEGIN");

    const result = await client.query<Account>(
      "SELECT balance FROM accounts WHERE id = $1",
      [accountId],
    );

    // Synchronization barrier between read and write
    await barrier();

    const newBalance = result.rows[0]!.balance + amount;
    await client.query("UPDATE accounts SET balance = $1 WHERE id = $2", [
      newBalance,
      accountId,
    ]);

    await client.query("COMMIT");
  };

  await Promise.all([credit(1, 50), credit(1, 50)]);

  // Still 150! READ COMMITTED isolation sees committed data per statement,
  // but doesn't prevent concurrent reads of stale values. A transaction
  // gives you a consistent snapshot per statement — not a write lock.
  expect(await getBalanceById(1)).toBe(150);
});

/**
 * 3. FOR UPDATE — barrier between read and write (deadlock)
 */
test("❌ 3. With write lock and barrier (deadlock)", async () => {
  const barrier = createBarrier(2);
  const clients: PoolClient[] = [];

  const credit = async (accountId: number, amount: number) => {
    const client = await getClient();
    // Keep a reference to the client so we can release deadlocked connections
    // after the test
    clients.push(client);

    await client.query("BEGIN");

    const result = await client.query<Account>(
      "SELECT balance FROM accounts WHERE id = $1 FOR UPDATE",
      [accountId],
    );

    // Synchronization barrier between read and write
    // Barrier AFTER the locked SELECT — T1 holds the lock and waits here.
    // T2 blocks on the lock and never reaches the barrier.
    await barrier();

    const newBalance = result.rows[0]!.balance + amount;
    await client.query("UPDATE accounts SET balance = $1 WHERE id = $2", [
      newBalance,
      accountId,
    ]);

    await client.query("COMMIT");
  };

  const result = await Promise.race([
    Promise.all([credit(1, 50), credit(1, 50)]).then(
      () => "completed" as const,
    ),
    new Promise<"deadlock">((resolve) =>
      setTimeout(() => resolve("deadlock"), 1000),
    ),
  ]);

  // T1 acquires the row lock, then waits at the barrier for T2.
  // T2 tries to lock the same row, blocks on T1's lock.
  // Neither can proceed — proving the lock works.
  expect(result).toBe("deadlock");

  // Terminate the stuck connections so subsequent tests can DROP TABLE
  clients.forEach((c) => c.release(true));
});

/**
 * 4. FOR UPDATE — barrier before SELECT (the solution)
 */

test("✅ 4. With write lock and barrier (barrier in correct position)", async () => {
  const barrier = createBarrier(2);

  const credit = async (accountId: number, amount: number) => {
    const client = await getClient();

    await client.query("BEGIN");

    // Synchronization barrier before read with write lock, after the transaction begins
    // Barrier BEFORE the SELECT — both transactions start before either
    // tries to acquire the lock
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

  await Promise.all([credit(1, 50), credit(1, 50)]);

  // FOR UPDATE serializes: T1 locks the row, T2 waits at the SELECT.
  // When T1 commits, T2 reads the updated value and computes correctly.
  expect(await getBalanceById(1)).toBe(200);
});

/**
 * 5. Proof: without FOR UPDATE the barrier alone changes nothing
 */
test("❌ 5. Without write lock and barrier (proof)", async () => {
  const barrier = createBarrier(2);

  const credit = async (accountId: number, amount: number) => {
    const client = await getClient();

    await client.query("BEGIN");

    // Synchronization barrier before read with write lock, after the transaction begins
    // Same barrier position as test 4, but no FOR UPDATE
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

  await Promise.all([credit(1, 50), credit(1, 50)]);

  // Same barrier, same position. Without the lock, both read stale data.
  // A correct barrier test passes with the lock and fails without it.
  expect(await getBalanceById(1)).toBe(150);
});
