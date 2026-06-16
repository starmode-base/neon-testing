import { expect, test } from "vitest";
import { neonWsErrorHandler } from "./ws-error";

function errorWith(message: string, stack: string) {
  const error = new Error(message);
  error.stack = stack;
  return error;
}

test("swallows the Neon WebSocket termination error", () => {
  const error = errorWith(
    "Connection terminated unexpectedly",
    [
      "Error: Connection terminated unexpectedly",
      "    at Sn.<anonymous> (file:///app/node_modules/.bun/@neondatabase+serverless@1.1.0/node_modules/@neondatabase/serverless/index.mjs:1010:76)",
      "    at Object.onceWrapper (file:///app/node_modules/.bun/@neondatabase+serverless@1.1.0/node_modules/@neondatabase/serverless/index.mjs:327:95)",
      "    at Sn.emit (file:///app/node_modules/.bun/@neondatabase+serverless@1.1.0/node_modules/@neondatabase/serverless/index.mjs:317:79)",
      "    at S.<anonymous> (file:///app/node_modules/.bun/@neondatabase+serverless@1.1.0/node_modules/@neondatabase/serverless/index.mjs:971:58)",
      "    at TrackingWebSocket.<anonymous> (file:///app/node_modules/.bun/@neondatabase+serverless@1.1.0/node_modules/@neondatabase/serverless/index.mjs:403:74)",
      "    at TLSSocket.onSocketClose (node:internal/deps/undici/undici:12062:7)",
    ].join("\n"),
  );

  expect(() => neonWsErrorHandler(error)).not.toThrow();
});

test("rethrows the same message from a non-Neon stack", () => {
  const error = errorWith(
    "Connection terminated unexpectedly",
    "Error: Connection terminated unexpectedly\n    at Connection (/app/node_modules/pg/lib/client.js:1:1)",
  );

  let thrown: unknown;

  try {
    neonWsErrorHandler(error);
  } catch (caught) {
    thrown = caught;
  }

  expect(thrown).toBe(error);
});

test("rethrows unrelated errors from the Neon stack", () => {
  const error = errorWith(
    "Something else entirely",
    "Error: Something else entirely\n    at Socket (/app/node_modules/@neondatabase/serverless/index.js:1:1)",
  );

  let thrown: unknown;

  try {
    neonWsErrorHandler(error);
  } catch (caught) {
    thrown = caught;
  }

  expect(thrown).toBe(error);
});

test("rethrows when neither message nor stack match", () => {
  const error = errorWith(
    "Something else entirely",
    "Error: Something else entirely\n    at Connection (/app/node_modules/pg/lib/client.js:1:1)",
  );

  let thrown: unknown;

  try {
    neonWsErrorHandler(error);
  } catch (caught) {
    thrown = caught;
  }

  expect(thrown).toBe(error);
});

test("rethrows the matching message when the stack is undefined", () => {
  const error = new Error("Connection terminated unexpectedly");
  delete error.stack;

  let thrown: unknown;

  try {
    neonWsErrorHandler(error);
  } catch (caught) {
    thrown = caught;
  }

  expect(thrown).toBe(error);
});
