import { expect, test } from "vitest";
import { applySslMode } from "./ssl";

test("returns the URI untouched when mode is undefined", () => {
  const uri =
    "postgresql://u:p@host/db?sslmode=require&channel_binding=require";

  expect(applySslMode(uri, undefined)).toBe(uri);
});

test("verify-full overwrites sslmode and strips uselibpqcompat", () => {
  const uri =
    "postgresql://u:p@host/db?sslmode=require&channel_binding=require&uselibpqcompat=true";
  const url = new URL(applySslMode(uri, "verify-full"));

  expect(url.searchParams.get("sslmode")).toBe("verify-full");
  expect(url.searchParams.has("uselibpqcompat")).toBe(false);
});

test("require sets sslmode and uselibpqcompat", () => {
  const uri =
    "postgresql://u:p@host/db?sslmode=verify-full&uselibpqcompat=false";
  const url = new URL(applySslMode(uri, "require"));

  expect(url.searchParams.get("sslmode")).toBe("require");
  expect(url.searchParams.get("uselibpqcompat")).toBe("true");
});

test("preserves unrelated query params", () => {
  const uri =
    "postgresql://u:p@host/db?sslmode=require&channel_binding=require";
  const url = new URL(applySslMode(uri, "verify-full"));

  expect(url.searchParams.get("channel_binding")).toBe("require");
});
