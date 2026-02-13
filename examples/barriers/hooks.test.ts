/**
 * Synchronization barriers: hooks demonstration
 *
 * The `credit` function is defined once with an optional hook. Production
 * callers don't pass it. Tests inject the barrier through it.
 *
 * Blog post: https://www.lirbank.com/harnessing-postgres-race-conditions
 */
import { beforeEach, expect, test } from "vitest";
import { Pool } from "@neondatabase/serverless";
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
 * Credit an account — the function under test
 *
 * The optional `hooks` parameter lets tests inject a synchronization barrier
 * without modifying the production code path.
 */
async function credit(
  accountId: number,
  amount: number,
  hooks?: { onTxBegin?: () => Promise<void> | void },
) {
  const client = await getClient();

  await client.query("BEGIN");

  if (hooks?.onTxBegin) {
    await hooks.onTxBegin();
  }

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
}

/**
 * 1. With barrier hook — deterministic concurrency
 *
 * The barrier forces both transactions to BEGIN before either acquires
 * the row lock, guaranteeing the interleaving that triggers a race.
 * FOR UPDATE serializes them correctly: balance is 200.
 */
test("✅ 1. With barrier hook: balance is 200 (correct)", async () => {
  const barrier = createBarrier(2);

  await Promise.all([
    credit(1, 50, { onTxBegin: barrier }),
    credit(1, 50, { onTxBegin: barrier }),
  ]);

  // ✅ Should be 200 with proper isolation
  expect(await getBalanceById(1)).toBe(200);
});

/**
 * 2. Without barrier hook — production code path
 *
 * No hooks, no barrier, no test overhead. Two concurrent credits still
 * produce the correct result — FOR UPDATE handles serialization on its own.
 */
test("✅ 2. Without barrier hook: production code path", async () => {
  await Promise.all([credit(1, 50), credit(1, 50)]);

  // ✅ Should be 200 with proper isolation
  expect(await getBalanceById(1)).toBe(200);
});
