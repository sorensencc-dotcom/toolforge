import test from "node:test";
import assert from "node:assert/strict";
import { normalizeErrorTrace, computeSignatureHash } from "../src/core/normalizer.ts";
import * as trmDevops from "../src/index.ts";

test("normalizer produces identical hash across Windows and Linux traces", () => {
  const winTrace = `\x1b[31m[2026-08-28T11:30:12.450Z] [145.2ms] runner-worker-491a PID: 4912 ERROR:\x1b[0m
Error: Policy violation in C:\\Users\\runner\\work\\toolforge\\src\\governance.ts:42
AuthTokenExpiredError: token expired at 2026-08-28T12:00:00Z for scope: write:packages`;

  const linuxTrace = `[2026-08-28T14:15:00.112Z] [89.1ms] runner-linux-node-889b PID: 9918 ERROR:
Error: Policy violation in /home/runner/work/toolforge/src/governance.ts:42
AuthTokenExpiredError: token expired at 2026-08-28T12:00:00Z for scope: write:packages`;

  const hashWin = computeSignatureHash(winTrace);
  const hashLinux = computeSignatureHash(linuxTrace);

  assert.equal(hashWin, hashLinux);
  assert.match(hashWin, /^[a-f0-9]{64}$/);
});

test("normalizer preserves distinct error signatures", () => {
  const trace1 = "Error: Secret missing GITHUB_TOKEN on step: Toolforge Release";
  const trace2 = "Error: Secret missing NPM_TOKEN on step: Toolforge Release";

  assert.notEqual(computeSignatureHash(trace1), computeSignatureHash(trace2));
});

test("normalizer strips ANSI codes and container IDs", () => {
  const raw = "\x1b[1;31m[2026-08-28 10:00:00] container_ci-runner-99 PID:  1234  Failed to execute\x1b[0m";
  const normalized = normalizeErrorTrace(raw);

  assert.equal(normalized, "<CONTAINER> <PID> Failed to execute");
});

test("normalizer strips execution durations but preserves semantic timestamps in error messages", () => {
  const raw = `[2026-08-28T09:00:00.000Z] [500ms] [2.5s] runner-main Task failed
Session expired on 2026-08-28T10:00:00Z during sync`;
  const normalized = normalizeErrorTrace(raw);

  assert.equal(
    normalized,
    `<RUNNER> Task failed\nSession expired on 2026-08-28T10:00:00Z during sync`
  );
});

test("normalizer trims and collapses extra whitespace and filters empty lines", () => {
  const raw = `

    First line with    extra   spaces   
    
    Second line
  `;
  const normalized = normalizeErrorTrace(raw);
  assert.equal(normalized, "First line with extra spaces\nSecond line");
});

test("index.ts correctly re-exports normalizer functions", () => {
  assert.equal(typeof trmDevops.normalizeErrorTrace, "function");
  assert.equal(typeof trmDevops.computeSignatureHash, "function");
});
