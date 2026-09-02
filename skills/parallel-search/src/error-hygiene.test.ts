// Error-hygiene static check (design spec §"Internal structure", §test strategy "Error hygiene").
// Every error the module emits must carry one of the ErrorCode constants declared in index.ts —
// whether built through the error() helper or written as an inline `code: "..."` object literal on
// the parallel_task_result timeout path. A drifted or typo'd code string fails here instead of
// leaking to a caller as an unrecognised error.

import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

// Derive the allow-list from the type declaration itself, so adding a code to the union
// (and its call sites) stays green while a stray string does not.
const unionMatch = source.match(/export type ErrorCode\s*=\s*([^;]+);/);
assert.ok(unionMatch, "ErrorCode union declaration not found in index.ts");
const knownCodes = new Set(
  unionMatch![1].split("|").map(s => s.trim().replace(/^"|"$/g, "")).filter(Boolean),
);

test("ErrorCode union lists the four expected codes", () => {
  assert.deepEqual(
    [...knownCodes].sort(),
    ["API_KEY_MISSING", "INVALID_API_RESPONSE", "INVALID_INPUT", "PARALLEL_API_ERROR"],
  );
});

test("every error() call site passes a known ErrorCode constant", () => {
  const calls = [...source.matchAll(/\berror\(\s*"([^"]*)"/g)].map(m => m[1]);
  assert.ok(calls.length >= 4, `expected several error() call sites, found ${calls.length}`);
  for (const code of calls) {
    assert.ok(knownCodes.has(code), `error() called with unknown code "${code}"`);
  }
});

test("every inline error object literal uses a known ErrorCode constant", () => {
  const codes = [...source.matchAll(/\bcode:\s*"([^"]*)"/g)].map(m => m[1]);
  assert.ok(codes.length >= 1, "expected at least one inline `code:` error literal");
  for (const code of codes) {
    assert.ok(knownCodes.has(code), `inline error literal uses unknown code "${code}"`);
  }
});
