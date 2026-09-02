import { strict as assert } from "node:assert";
import test from "node:test";
import Parallel from "parallel-web";
import { charlieDeepResearchSearch, charlieResearchQueries } from "./charlie-deep-research-adapter.js";

test("charlieResearchQueries returns the documented historical / primary-source triple", () => {
  assert.deepEqual(charlieResearchQueries("Willow Run"), [
    "Willow Run",
    "Willow Run history",
    "Willow Run primary sources",
  ]);
  assert.deepEqual(charlieResearchQueries("  spaced  "), ["spaced", "spaced history", "spaced primary sources"]);
});

test("Charlie adapter is disabled by default", async () => {
  const result = await charlieDeepResearchSearch("Willow Run", "The Industrial Architect", { enabled: false, apiKey: "k" });
  assert.deepEqual(result, { ok: false, error: { code: "FEATURE_DISABLED" } });
});

test("Charlie adapter normalizes real-shaped SearchResult records (regression: defect 8)", async () => {
  const result = await charlieDeepResearchSearch("Willow Run", "The Industrial Architect", {
    enabled: true,
    apiKey: "k",
    clientFactory: () => ({
      beta: {
        search: async () => ({ search_id: "s_x", results: [{ url: "https://a.test", title: "A", excerpts: ["ex one"] }] }),
        extract: async () => ({}),
      },
      taskRun: { create: async () => ({}) },
    } as any),
  });
  assert.deepEqual(result, { ok: true, data: [{ title: "A", url: "https://a.test", snippet: "ex one" }] });
});

test("Charlie adapter drops records missing title or a valid url", async () => {
  const result = await charlieDeepResearchSearch("Willow Run", "The Industrial Architect", {
    enabled: true,
    apiKey: "k",
    clientFactory: () => ({
      beta: {
        search: async () => ({ search_id: "s_x", results: [{ url: "not-a-url", title: "A" }, { url: "https://a.test" }] }),
        extract: async () => ({}),
      },
      taskRun: { create: async () => ({}) },
    } as any),
  });
  assert.deepEqual(result, { ok: true, data: [] });
});

test("Charlie adapter preserves fail-closed provider errors", async () => {
  const result = await charlieDeepResearchSearch("Willow Run", "The Industrial Architect", {
    enabled: true,
    apiKey: "k",
    clientFactory: () => ({ beta: { search: async () => { throw new Error("secret"); }, extract: async () => ({}) }, taskRun: { create: async () => ({}) } } as any),
  });
  assert.deepEqual(result, { ok: false, error: { code: "PARALLEL_API_ERROR" } });
});

test("Charlie adapter taskRun path normalizes citations from the Task Run result basis", async () => {
  const result = await charlieDeepResearchSearch("Willow Run", "The Industrial Architect", {
    enabled: true,
    taskRun: true,
    apiKey: "k",
    clientFactory: () => ({
      beta: { search: async () => ({}), extract: async () => ({}) },
      taskRun: {
        create: async () => ({ run_id: "run_1", interaction_id: "i_1", status: "queued", is_active: true, processor: "core" }),
        result: async () => ({
          output: {
            type: "text",
            content: "x",
            basis: [
              { citations: [
                { url: "https://a.test", title: "A", excerpts: ["ex a"] },
                { url: "https://b.test", excerpts: ["ex b"] },
              ] },
            ],
          },
          run: { run_id: "run_1", interaction_id: "i_1", status: "completed", is_active: false, processor: "core" },
        }),
      },
    } as any),
  });
  assert.deepEqual(result, { ok: true, data: [{ title: "A", url: "https://a.test", snippet: "ex a" }] });
});

test("Charlie adapter taskRun path surfaces run_id when parallel_task_result times out", async () => {
  const result = await charlieDeepResearchSearch("Willow Run", "The Industrial Architect", {
    enabled: true,
    taskRun: true,
    apiKey: "k",
    clientFactory: () => ({
      beta: { search: async () => ({}), extract: async () => ({}) },
      taskRun: {
        create: async () => ({ run_id: "run_2", interaction_id: "i_2", status: "queued", is_active: true, processor: "core" }),
        result: async () => { throw new Parallel.APIConnectionTimeoutError({ message: "timed out" }); },
      },
    } as any),
  });
  assert.deepEqual(result, { ok: false, error: { code: "PARALLEL_API_ERROR", run_id: "run_2" } });
});

test("Charlie adapter taskRun path carries no run_id when task creation itself fails", async () => {
  const result = await charlieDeepResearchSearch("Willow Run", "The Industrial Architect", {
    enabled: true,
    taskRun: true,
    apiKey: "k",
    clientFactory: () => ({
      beta: { search: async () => ({}), extract: async () => ({}) },
      taskRun: {
        create: async () => { throw new Error("boom"); },
      },
    } as any),
  });
  assert.deepEqual(result, { ok: false, error: { code: "PARALLEL_API_ERROR" } });
  assert.equal("run_id" in (result as { ok: false; error: Record<string, unknown> }).error, false);
});

test("Charlie adapter taskRun path sources run_id from the parallel_task response when parallel_task_result fails its shape guard", async () => {
  const result = await charlieDeepResearchSearch("Willow Run", "The Industrial Architect", {
    enabled: true,
    taskRun: true,
    apiKey: "k",
    clientFactory: () => ({
      beta: { search: async () => ({}), extract: async () => ({}) },
      taskRun: {
        create: async () => ({ run_id: "run_9", interaction_id: "i_9", status: "queued", is_active: true, processor: "core" }),
        // Structurally invalid wait:true body: no output.content / output.basis, run.status absent.
        // parallel_task_result returns { ok:false, error:{ code:"INVALID_API_RESPONSE" } } with NO run_id key,
        // so a surfaced run_id can only have come from created.data.run_id.
        result: async () => ({ output: { type: "text" }, run: {} }),
      },
    } as any),
  });
  assert.deepEqual(result, { ok: false, error: { code: "INVALID_API_RESPONSE", run_id: "run_9" } });
});
