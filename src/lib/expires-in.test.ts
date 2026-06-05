import { expect, test } from "vitest";
import { validateExpiresIn } from "./expires-in";

test("accepts undefined and null", () => {
  expect(() => validateExpiresIn(undefined)).not.toThrow();
  expect(() => validateExpiresIn(null)).not.toThrow();
});

test("accepts positive integers up to the 30-day boundary", () => {
  expect(() => validateExpiresIn(1)).not.toThrow();
  expect(() => validateExpiresIn(600)).not.toThrow();
  expect(() => validateExpiresIn(2592000)).not.toThrow();
});

test("rejects non-integers", () => {
  expect(() => validateExpiresIn(600.5)).toThrow(
    "expiresIn must be an integer",
  );
});

test("rejects zero and negatives", () => {
  expect(() => validateExpiresIn(0)).toThrow("must be a positive integer");
  expect(() => validateExpiresIn(-10)).toThrow("must be a positive integer");
});

test("rejects values past 30 days", () => {
  expect(() => validateExpiresIn(2592001)).toThrow("must not exceed 30 days");
});
