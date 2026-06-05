import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { withRetry } from "./with-retry";

const locked = {
  name: "AxiosError",
  message: "Request failed with status code 423",
  code: "ERR_BAD_REQUEST",
  isAxiosError: true,
  response: {
    status: 423,
    statusText: "Locked",
    data: {
      request_id: "c9d26dc0-add8-446a-abd9-25211511983c",
      code: "",
      message:
        "project has too many running operations, scheduling of new ones is prohibited",
    },
  },
};

beforeEach(() => {
  vi.useFakeTimers();
  // Keep retry logs out of test output.
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
  const fn = vi.fn(async () => "x");

  await expect(
    withRetry(fn, { maxRetries: n, baseDelayMs: 1 }),
  ).rejects.toThrow("maxRetries must be a positive integer");
  expect(fn).not.toHaveBeenCalled();
});

test.each([0, -1, 1.5, NaN])("rejects invalid baseDelayMs: %s", async (n) => {
  const fn = vi.fn(async () => "x");

  await expect(
    withRetry(fn, { maxRetries: 1, baseDelayMs: n }),
  ).rejects.toThrow("baseDelayMs must be a positive integer");
  expect(fn).not.toHaveBeenCalled();
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

test("waits longer between 423 retries and gives up after maxRetries", async () => {
  const fn = vi.fn().mockRejectedValue(locked);

  const promise = withRetry(fn, { maxRetries: 4, baseDelayMs: 100 });
  const rejects = expect(promise).rejects.toBe(locked);

  expect(fn).toHaveBeenCalledTimes(1);

  await vi.advanceTimersByTimeAsync(99);
  expect(fn).toHaveBeenCalledTimes(1);

  await vi.advanceTimersByTimeAsync(1);
  expect(fn).toHaveBeenCalledTimes(2);

  await vi.advanceTimersByTimeAsync(199);
  expect(fn).toHaveBeenCalledTimes(2);

  await vi.advanceTimersByTimeAsync(1);
  expect(fn).toHaveBeenCalledTimes(3);

  await vi.advanceTimersByTimeAsync(399);
  expect(fn).toHaveBeenCalledTimes(3);

  await vi.advanceTimersByTimeAsync(1);
  await rejects;

  expect(fn).toHaveBeenCalledTimes(4);
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
