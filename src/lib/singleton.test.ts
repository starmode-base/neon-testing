import { expect, test } from "vitest";
import { lazySingleton } from "./singleton";

test("does not call the factory until first access", () => {
  let calls = 0;
  lazySingleton(() => ++calls);

  expect(calls).toBe(0);
});

test("calls the factory once and caches the instance", () => {
  let calls = 0;
  const get = lazySingleton(() => ({ id: ++calls }));

  const a = get();
  const b = get();

  expect(a).toBe(b);
  expect(calls).toBe(1);
});
