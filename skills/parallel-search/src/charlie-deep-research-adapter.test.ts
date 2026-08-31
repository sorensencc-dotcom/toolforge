import { strict as assert } from "node:assert";
import test from "node:test";
import { charlieDeepResearchSearch } from "./charlie-deep-research-adapter.js";

test("Charlie adapter is disabled by default", async () => {
  const result = await charlieDeepResearchSearch("Willow Run", "The Industrial Architect", { enabled: false, apiKey: "k" });
  assert.deepEqual(result, { ok: false, error: { code: "FEATURE_DISABLED" } });
});

test("Charlie adapter normalizes search records", async () => {
  const result = await charlieDeepResearchSearch("Willow Run", "The Industrial Architect", { enabled: true, apiKey: "k", clientFactory: () => ({ search: async () => ({ results: [{ title: "Willow Run", url: "https://example.com/willow", snippet: "Assembly history" }] }), extract: async () => ({}), taskRun: { create: async () => ({}) } }) });
  assert.deepEqual(result, { ok: true, data: [{ title: "Willow Run", url: "https://example.com/willow", snippet: "Assembly history" }] });
});

test("Charlie adapter preserves fail-closed provider errors", async () => {
  const result = await charlieDeepResearchSearch("Willow Run", "The Industrial Architect", { enabled: true, apiKey: "k", clientFactory: () => ({ search: async () => { throw new Error("secret"); }, extract: async () => ({}), taskRun: { create: async () => ({}) } }) });
  assert.deepEqual(result, { ok: false, error: { code: "PARALLEL_API_ERROR" } });
});
