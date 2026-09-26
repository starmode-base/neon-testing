import { expect, test } from "vitest";
import { pickName } from "./pick-name";

const roles = [{ name: "app_user" }, { name: "neondb_owner" }];
const databases = [{ name: "analytics" }, { name: "neondb" }];

test("returns the requested name when it exists", () => {
  expect(pickName("role", roles, "app_user", "neondb_owner")).toBe("app_user");
  expect(pickName("database", databases, "analytics", "neondb")).toBe(
    "analytics",
  );
});

test("rejects a requested name that does not exist", () => {
  expect(() => pickName("role", roles, "missing", "neondb_owner")).toThrow(
    "Role not found: missing",
  );
  expect(() => pickName("database", databases, "missing", "neondb")).toThrow(
    "Database not found: missing",
  );
});

test("prefers the default name when nothing is requested", () => {
  expect(pickName("role", roles, undefined, "neondb_owner")).toBe(
    "neondb_owner",
  );
  expect(pickName("database", databases, undefined, "neondb")).toBe("neondb");
});

test("falls back to the first candidate when the default is absent", () => {
  const custom = [{ name: "first" }, { name: "second" }];

  expect(pickName("role", custom, undefined, "neondb_owner")).toBe("first");
  expect(pickName("database", custom, undefined, "neondb")).toBe("first");
});

test("rejects an empty candidate list", () => {
  expect(() => pickName("role", [], undefined, "neondb_owner")).toThrow(
    "No role available in branch",
  );
  expect(() => pickName("database", [], undefined, "neondb")).toThrow(
    "No database available in branch",
  );
});
