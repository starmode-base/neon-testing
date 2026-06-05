import { expect, test } from "vitest";
import { createBarrier } from "./barrier";

/**
 * Resolves only after the microtask queue has drained (a timer fires after all
 * pending microtasks), so any promise that was going to settle already has.
 */
const drainMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

test("count of 1 releases immediately", async () => {
  const arrive = createBarrier(1);

  await expect(arrive()).resolves.toBeUndefined();
});

test("blocks until count callers arrive, then releases all", async () => {
  const arrive = createBarrier(2);

  const released: number[] = [];
  const first = arrive().then(() => released.push(1));

  // Only one of two arrived: even after draining microtasks the first caller
  // must still be blocked
  await drainMicrotasks();
  expect(released).toEqual([]);

  // Second arrival releases both
  const second = arrive().then(() => released.push(2));

  await Promise.all([first, second]);
  expect(released).toEqual([1, 2]);
});
