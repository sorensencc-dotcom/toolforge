import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { tinyfish_search } from "../src/search.js";

describe("tinyfish_search", () => {
  test("fails closed when TINYFISH_API_KEY is missing", async () => {
    const original = process.env.TINYFISH_API_KEY;
    delete process.env.TINYFISH_API_KEY;
    const res = await tinyfish_search({ objective: "test query" });
    if (original) process.env.TINYFISH_API_KEY = original;

    assert.equal(res.ok, false);
    assert.equal(res.error.code, "API_KEY_MISSING");
  });

  test("fails closed when objective and search_queries are missing", async () => {
    const res = await tinyfish_search({}, { apiKey: "test-key" });
    assert.equal(res.ok, false);
    assert.equal(res.error.code, "INVALID_INPUT");
  });

  test("normalizes results with mock client", async () => {
    const mockClient = {
      search: {
        query: async () => ({
          results: [{ title: "Result 1", url: "https://example.com", snippet: "Snippet" }],
        }),
      },
      fetch: {} as any,
    };

    const res = await tinyfish_search(
      { objective: "find documentation" },
      { apiKey: "test-key", clientFactory: () => mockClient },
    );

    assert.equal(res.ok, true);
    assert.equal(res.data.results.length, 1);
    assert.equal(res.data.results[0].title, "Result 1");
  });
});
