import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { withRetry } from "./with-retry";

const locked = { response: { status: 423 } };

beforeEach(() => {
  vi.useFakeTimers();
  // The retry path logs to console.log on every 423 — keep test output clean
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

test("returns the result without retrying when fn succeeds", async () => {
  const fn = vi.fn().mockResolvedValue("ok");

  await expect(withRetry(fn, { maxRetries: 3, baseDelayMs: 10 })).resolves.toBe(
    "ok",
  );
  expect(fn).toHaveBeenCalledTimes(1);
});

test.each([0, -1, 1.5, NaN])("rejects invalid maxRetries: %s", async (n) => {
  await expect(
    withRetry(async () => "x", { maxRetries: n, baseDelayMs: 1 }),
  ).rejects.toThrow("maxRetries must be a positive integer");
});

test.each([0, -1, 1.5, NaN])("rejects invalid baseDelayMs: %s", async (n) => {
  await expect(
    withRetry(async () => "x", { maxRetries: 1, baseDelayMs: n }),
  ).rejects.toThrow("baseDelayMs must be a positive integer");
});

test("retries on 423, then returns the eventual success", async () => {
  const fn = vi
    .fn()
    .mockRejectedValueOnce(locked)
    .mockRejectedValueOnce(locked)
    .mockResolvedValue("ok");

  const promise = withRetry(fn, { maxRetries: 5, baseDelayMs: 50 });
  await vi.runAllTimersAsync();

  await expect(promise).resolves.toBe("ok");
  expect(fn).toHaveBeenCalledTimes(3);
});

test("backs off exponentially and gives up after maxRetries on a 423", async () => {
  const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
  const fn = vi.fn().mockRejectedValue(locked);

  const promise = withRetry(fn, { maxRetries: 4, baseDelayMs: 100 });
  const rejects = expect(promise).rejects.toBe(locked);

  await vi.runAllTimersAsync();
  await rejects;

  // 4 attempts, 3 waits between them: 100·2^0, 100·2^1, 100·2^2
  expect(fn).toHaveBeenCalledTimes(4);
  expect(setTimeoutSpy.mock.calls.map((call) => call[1])).toEqual([
    100, 200, 400,
  ]);
});

test("does not retry non-423 errors and surfaces Neon API details", async () => {
  const apiError = {
    response: {
      status: 409,
      data: { code: "BRANCHES_LIMIT_EXCEEDED", message: "too many branches" },
    },
  };
  const fn = vi.fn().mockRejectedValue(apiError);

  let thrown: Error | undefined;
  try {
    await withRetry(fn, { maxRetries: 3, baseDelayMs: 1 });
  } catch (error) {
    thrown = error as Error;
  }

  expect(thrown?.message).toBe(
    "Neon API error - HTTP 409 - BRANCHES_LIMIT_EXCEEDED - too many branches",
  );
  expect(thrown?.cause).toBe(apiError);
  expect(fn).toHaveBeenCalledTimes(1);
});

test("passes non-API errors through unchanged", async () => {
  const networkError = new Error("network down");
  const fn = vi.fn().mockRejectedValue(networkError);

  await expect(withRetry(fn, { maxRetries: 3, baseDelayMs: 1 })).rejects.toBe(
    networkError,
  );
  expect(fn).toHaveBeenCalledTimes(1);
});
