import { strict as assert } from "node:assert";
import test from "node:test";
import Parallel from "parallel-web";
import {
  parallel_extract,
  parallel_search,
  parallel_task,
  parallel_task_result,
  TASK_RESULT_TIMEOUT_DEFAULT,
  TASK_RESULT_TIMEOUT_MAX,
} from "./index.js";

test("fails closed without API key", async () => {
  const r = await parallel_search({ objective: "x" }, { apiKey: " " });
  assert.deepEqual(r, { ok: false, error: { code: "API_KEY_MISSING", message: "PARALLEL_API_KEY is required" } });
});

test("requires objective or search_queries", async () => {
  const r = await parallel_search({}, { apiKey: "k" });
  assert.equal(r.ok, false);
  assert.equal((r as { ok: false; error: { code: string } }).error.code, "INVALID_INPUT");
});

test("accepts search_queries-only input", async () => {
  const r = await parallel_search({ search_queries: ["a", "b"] }, {
    apiKey: "k",
    clientFactory: () => ({ beta: { search: async () => ({ results: [], search_id: "s" }), extract: async () => ({ results: [], errors: [] }) }, taskRun: { create: async () => ({}) } } as any),
  });
  assert.equal(r.ok, true);
});

test("validates extract URL limit", async () => {
  const r = await parallel_extract({ urls: Array.from({ length: 21 }, (_, i) => `https://example.com/${i}`) }, { apiKey: "k" });
  assert.equal(r.ok, false);
});

test("calls taskRun create and returns task status", async () => {
  const r = await parallel_task({ input: "research", processor: "base" }, {
    apiKey: "k",
    clientFactory: () => ({ beta: { search: async () => ({}), extract: async () => ({}) }, taskRun: { create: async () => ({ run_id: "r", interaction_id: "i", status: "queued", is_active: true, processor: "base" }) } } as any),
  });
  assert.deepEqual(r, { ok: true, data: { run_id: "r", interaction_id: "i", status: "queued", is_active: true, processor: "base" } });
});

test("maps SDK failure without leaking details", async () => {
  const r = await parallel_search({ objective: "x" }, {
    apiKey: "k",
    clientFactory: () => ({ beta: { search: async () => { throw new Error("secret"); }, extract: async () => ({}) }, taskRun: { create: async () => ({}) } } as any),
  });
  assert.deepEqual(r, { ok: false, error: { code: "PARALLEL_API_ERROR", message: "Parallel request failed" } });
});

test("onError receives the raw error while the return value stays opaque", async () => {
  let seen: unknown;
  const thrown = new Error("boom-secret");
  const r = await parallel_search({ objective: "x" }, {
    apiKey: "k",
    onError: (err) => { seen = err; },
    clientFactory: () => { throw thrown; },
  });
  assert.equal(seen, thrown);
  assert.deepEqual(r, { ok: false, error: { code: "PARALLEL_API_ERROR", message: "Parallel request failed" } });
});

test("PARALLEL_DEBUG logs the raw SDK error to console.error", async () => {
  const original = console.error;
  const calls: unknown[][] = [];
  console.error = (...args: unknown[]) => { calls.push(args); };
  process.env.PARALLEL_DEBUG = "1";
  const thrown = new Error("raw-sdk-detail");
  try {
    const r = await parallel_search({ objective: "x" }, {
      apiKey: "k",
      clientFactory: () => ({ beta: { search: async () => { throw thrown; }, extract: async () => ({}) }, taskRun: { create: async () => ({}) } } as any),
    });
    assert.deepEqual(r, { ok: false, error: { code: "PARALLEL_API_ERROR", message: "Parallel request failed" } });
    assert.equal(calls.some((a) => a[0] === thrown), true);
  } finally {
    console.error = original;
    delete process.env.PARALLEL_DEBUG;
  }
});

test("a throwing onError callback does not break the never-throw contract", async () => {
  const r = await parallel_search({ objective: "x" }, {
    apiKey: "k",
    onError: () => { throw new Error("logger blew up"); },
    clientFactory: () => ({ beta: { search: async () => { throw new Error("api"); }, extract: async () => ({}) }, taskRun: { create: async () => ({}) } } as any),
  });
  assert.deepEqual(r, { ok: false, error: { code: "PARALLEL_API_ERROR", message: "Parallel request failed" } });
});

test("invalid response shape routes through the debug sink and returns INVALID_API_RESPONSE", async () => {
  const original = console.error;
  const calls: unknown[][] = [];
  console.error = (...args: unknown[]) => { calls.push(args); };
  process.env.PARALLEL_DEBUG = "1";
  let seen: unknown;
  const badBody = { unexpected: "no results array" };
  try {
    const r = await parallel_search({ objective: "x" }, {
      apiKey: "k",
      onError: (err) => { seen = err; },
      clientFactory: () => ({ beta: { search: async () => badBody, extract: async () => ({}) }, taskRun: { create: async () => ({}) } } as any),
    });
    assert.deepEqual(r, { ok: false, error: { code: "INVALID_API_RESPONSE", message: "Parallel returned an invalid response" } });
    assert.equal(seen, badBody);
    assert.equal(calls.some((a) => a[0] === badBody), true);
  } finally {
    console.error = original;
    delete process.env.PARALLEL_DEBUG;
  }
});

test("extract call includes the search-extract beta header", async () => {
  let seenParams: Record<string, unknown> | undefined;
  const r = await parallel_extract({ urls: ["https://example.com/a"] }, {
    apiKey: "k",
    clientFactory: () => ({
      beta: {
        search: async () => ({}),
        extract: async (params: Record<string, unknown>) => { seenParams = params; return { results: [], errors: [] }; },
      },
      taskRun: { create: async () => ({}) },
    } as any),
  });
  assert.equal(r.ok, true);
  assert.deepEqual(seenParams?.betas, ["search-extract-2025-10-10"]);
});

// --- Task 4: parallel_task_result wrapper -----------------------------------

const taskResultClient = (taskRun: Record<string, unknown>) =>
  ({ beta: { search: async () => ({}), extract: async () => ({}) }, taskRun } as any);

test("task_result rejects an empty run_id", async () => {
  const r = await parallel_task_result({ run_id: " " }, { apiKey: "k" });
  assert.deepEqual(r, { ok: false, error: { code: "INVALID_INPUT", message: "run_id and timeout_seconds must be valid" } });
});

test("task_result rejects timeout_seconds over the max", async () => {
  const r = await parallel_task_result({ run_id: "r", timeout_seconds: TASK_RESULT_TIMEOUT_MAX + 100 }, { apiKey: "k" });
  assert.deepEqual(r, { ok: false, error: { code: "INVALID_INPUT", message: "run_id and timeout_seconds must be valid" } });
});

test("task_result wait:false polls retrieve and narrows to the 5-field subset", async () => {
  const r = await parallel_task_result({ run_id: "r" }, {
    apiKey: "k",
    clientFactory: () => taskResultClient({
      retrieve: async () => ({ run_id: "r", interaction_id: "i", status: "running", is_active: true, processor: "core", created_at: null, modified_at: null }),
    }),
  });
  assert.deepEqual(r, { ok: true, data: { run_id: "r", interaction_id: "i", status: "running", is_active: true, processor: "core" } });
});

test("task_result wait:true delegates to result with the default timeout and unwraps output", async () => {
  let seenQuery: unknown;
  const r = await parallel_task_result({ run_id: "r", wait: true }, {
    apiKey: "k",
    clientFactory: () => taskResultClient({
      result: async (_id: string, query: unknown) => {
        seenQuery = query;
        return { output: { type: "text", content: "x", basis: [] }, run: { run_id: "r", interaction_id: "i", status: "completed", is_active: false, processor: "core" } };
      },
    }),
  });
  assert.deepEqual(seenQuery, { timeout: TASK_RESULT_TIMEOUT_DEFAULT });
  assert.deepEqual(r, { ok: true, data: { status: "completed", output: { type: "text", content: "x", basis: [] } } });
});

test("task_result treats a terminal 'failed' status from retrieve as data, not an error", async () => {
  const r = await parallel_task_result({ run_id: "r" }, {
    apiKey: "k",
    clientFactory: () => taskResultClient({
      retrieve: async () => ({ run_id: "r", interaction_id: "i", status: "failed", is_active: false, processor: "core" }),
    }),
  });
  assert.equal(r.ok, true);
  assert.equal((r as { ok: true; data: { status: string } }).data.status, "failed");
});

test("task_result treats a terminal 'cancelled' status from retrieve as data, not an error", async () => {
  const r = await parallel_task_result({ run_id: "r" }, {
    apiKey: "k",
    clientFactory: () => taskResultClient({
      retrieve: async () => ({ run_id: "r", interaction_id: "i", status: "cancelled", is_active: false, processor: "core" }),
    }),
  });
  assert.equal(r.ok, true);
  assert.equal((r as { ok: true; data: { status: string } }).data.status, "cancelled");
});

test("task_result wait:true maps a real APIConnectionTimeoutError to PARALLEL_API_ERROR with run_id", async () => {
  const r = await parallel_task_result({ run_id: "r", wait: true }, {
    apiKey: "k",
    clientFactory: () => taskResultClient({
      result: async () => { throw new Parallel.APIConnectionTimeoutError({ message: "timed out" }); },
    }),
  });
  assert.deepEqual(r, { ok: false, error: { code: "PARALLEL_API_ERROR", message: "Parallel request failed", run_id: "r" } });
});

test("task_result wait:true maps a plain error to PARALLEL_API_ERROR with no run_id key", async () => {
  const r = await parallel_task_result({ run_id: "r", wait: true }, {
    apiKey: "k",
    clientFactory: () => taskResultClient({
      result: async () => { throw new Error("boom"); },
    }),
  });
  assert.deepEqual(r, { ok: false, error: { code: "PARALLEL_API_ERROR", message: "Parallel request failed" } });
  assert.equal("run_id" in (r as { ok: false; error: object }).error, false);
});

test("task_result wait:false returns INVALID_API_RESPONSE when retrieve omits run_id", async () => {
  const r = await parallel_task_result({ run_id: "r" }, {
    apiKey: "k",
    clientFactory: () => taskResultClient({
      retrieve: async () => ({ interaction_id: "i", status: "running", is_active: true, processor: "core" }),
    }),
  });
  assert.deepEqual(r, { ok: false, error: { code: "INVALID_API_RESPONSE", message: "Parallel returned an invalid response" } });
});

test("task_result wait:true custom timeout catch still feeds the onError debug sink", async () => {
  let seen: unknown;
  const r = await parallel_task_result({ run_id: "r", wait: true }, {
    apiKey: "k",
    onError: (e) => { seen = e; },
    clientFactory: () => taskResultClient({
      result: async () => { throw new Parallel.APIConnectionTimeoutError({ message: "timed out" }); },
    }),
  });
  assert.equal(seen instanceof Parallel.APIConnectionTimeoutError, true);
  assert.deepEqual(r, { ok: false, error: { code: "PARALLEL_API_ERROR", message: "Parallel request failed", run_id: "r" } });
});
