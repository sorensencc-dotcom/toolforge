// Live smoke test for defect 7. Hits the real Parallel API once per case.
// Skipped entirely when PARALLEL_API_KEY is absent, so CI never fails on it.
// Each case sets PARALLEL_DEBUG in its own body with a finally-restore (never at
// module scope) so importing this file alongside other suites cannot leak raw
// error logging into them.

import { strict as assert } from "node:assert";
import test from "node:test";
import Parallel from "parallel-web";

const skip = !process.env.PARALLEL_API_KEY;

async function withDebug(fn: () => Promise<void>): Promise<void> {
  const prev = process.env.PARALLEL_DEBUG;
  process.env.PARALLEL_DEBUG = "1";
  try {
    await fn();
  } finally {
    if (prev === undefined) delete process.env.PARALLEL_DEBUG;
    else process.env.PARALLEL_DEBUG = prev;
  }
}

test("live: client.beta.search resolves a SearchResult shape", { skip }, async () => {
  await withDebug(async () => {
    const client = new Parallel({ apiKey: process.env.PARALLEL_API_KEY });
    const res = await client.beta.search({ objective: "test", mode: "agentic" });
    assert.ok(Array.isArray(res.results), "results is an array");
    assert.equal(typeof res.search_id, "string", "search_id is a string");
  });
});

test("live: client.taskRun.create resolves a TaskRun shape", { skip }, async () => {
  await withDebug(async () => {
    const client = new Parallel({ apiKey: process.env.PARALLEL_API_KEY });
    const run = await client.taskRun.create({ processor: "base", input: "test" });
    assert.equal(typeof run.run_id, "string", "run_id is a string");
    assert.equal(typeof run.interaction_id, "string", "interaction_id is a string");
    assert.equal(typeof run.status, "string", "status is a string");
    assert.equal(typeof run.is_active, "boolean", "is_active is a boolean");
    assert.equal(typeof run.processor, "string", "processor is a string");
  });
});
