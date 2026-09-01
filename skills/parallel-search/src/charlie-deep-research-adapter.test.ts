import { strict as assert } from "node:assert";
import test from "node:test";
import { charlieDeepResearchSearch } from "./charlie-deep-research-adapter.js";

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
