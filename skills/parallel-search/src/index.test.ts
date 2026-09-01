import { strict as assert } from "node:assert";
import test from "node:test";
import { parallel_extract, parallel_search, parallel_task } from "./index.js";

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
