import { expect, test } from "vitest";
import { applySslMode } from "./ssl";

const base = "postgresql://u:p@host/db?sslmode=require&channel_binding=require";

test("returns the URI untouched when mode is undefined", () => {
  expect(applySslMode(base, undefined)).toBe(base);
});

test("verify-full overwrites sslmode and strips uselibpqcompat", () => {
  const url = new URL(
    applySslMode(`${base}&uselibpqcompat=true`, "verify-full"),
  );

  expect(url.searchParams.get("sslmode")).toBe("verify-full");
  expect(url.searchParams.has("uselibpqcompat")).toBe(false);
});

test("require sets sslmode and uselibpqcompat", () => {
  const url = new URL(applySslMode(base, "require"));

  expect(url.searchParams.get("sslmode")).toBe("require");
  expect(url.searchParams.get("uselibpqcompat")).toBe("true");
});

test("preserves unrelated query params", () => {
  const url = new URL(applySslMode(base, "verify-full"));

  expect(url.searchParams.get("channel_binding")).toBe("require");
});
