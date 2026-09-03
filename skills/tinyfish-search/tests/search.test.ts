import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { ERR_MSG_API_KEY_MISSING } from "../src/client.js";
import { ERR_MSG_FAILED } from "../src/limiter.js";
import {
  tinyfish_search,
  ERR_MSG_INVALID_INPUT,
  ERR_MSG_INVALID_API_RESPONSE,
} from "../src/search.js";

describe("tinyfish_search", () => {
  test("fails closed when TINYFISH_API_KEY is missing", async () => {
    const original = process.env.TINYFISH_API_KEY;
    try {
      delete process.env.TINYFISH_API_KEY;
      const res = await tinyfish_search({ objective: "test query" });

      assert.equal(res.ok, false);
      assert.equal(res.error.code, "API_KEY_MISSING");
      assert.equal(res.error.message, ERR_MSG_API_KEY_MISSING);
    } finally {
      if (original !== undefined) {
        process.env.TINYFISH_API_KEY = original;
      } else {
        delete process.env.TINYFISH_API_KEY;
      }
    }
  });

  test("fails closed when objective and search_queries are missing or blank", async () => {
    const res1 = await tinyfish_search({}, { apiKey: "test-key" });
    assert.equal(res1.ok, false);
    assert.equal(res1.error.code, "INVALID_INPUT");
    assert.equal(res1.error.message, ERR_MSG_INVALID_INPUT);

    const res2 = await tinyfish_search(
      { objective: "   ", search_queries: ["   ", ""] },
      { apiKey: "test-key" },
    );
    assert.equal(res2.ok, false);
    assert.equal(res2.error.code, "INVALID_INPUT");
    assert.equal(res2.error.message, ERR_MSG_INVALID_INPUT);
  });

  test("resolves query via search_queries fallback when objective is undefined or blank", async () => {
    let capturedQuery: string | undefined;
    const mockClient = {
      search: {
        query: async ({ query }: { query: string }) => {
          capturedQuery = query;
          return { results: [] };
        },
      },
      fetch: {} as any,
    };

    // Case 1: objective is undefined
    const res1 = await tinyfish_search(
      { search_queries: ["fallback query 1"] },
      { apiKey: "test-key", clientFactory: () => mockClient },
    );
    assert.equal(res1.ok, true);
    assert.equal(capturedQuery, "fallback query 1");

    // Case 2: objective is blank / whitespace
    const res2 = await tinyfish_search(
      { objective: "   ", search_queries: ["   ", "fallback query 2"] },
      { apiKey: "test-key", clientFactory: () => mockClient },
    );
    assert.equal(res2.ok, true);
    assert.equal(capturedQuery, "fallback query 2");
  });

  test("returns INVALID_API_RESPONSE when client returns null, undefined, or non-array results", async () => {
    const testCases: any[] = [
      null,
      undefined,
      {},
      { results: null },
      { results: undefined },
      { results: "not an array" },
      { results: 123 },
    ];

    for (const mockResponse of testCases) {
      const mockClient = {
        search: {
          query: async () => mockResponse,
        },
        fetch: {} as any,
      };

      const res = await tinyfish_search(
        { objective: "test query" },
        { apiKey: "test-key", clientFactory: () => mockClient },
      );

      assert.equal(res.ok, false);
      assert.equal(res.error.code, "INVALID_API_RESPONSE");
      assert.equal(res.error.message, ERR_MSG_INVALID_API_RESPONSE);
    }
  });

  test("handles client failure when query throws: calls options.onError and returns TINYFISH_API_ERROR", async () => {
    const errorToThrow = new Error("TinyFish backend exploded");
    let caughtCallbackError: any;

    const mockClient = {
      search: {
        query: async () => {
          throw errorToThrow;
        },
      },
      fetch: {} as any,
    };

    const res = await tinyfish_search(
      { objective: "test query" },
      {
        apiKey: "test-key",
        clientFactory: () => mockClient,
        onError: (err) => {
          caughtCallbackError = err;
        },
      },
    );

    assert.equal(caughtCallbackError, errorToThrow);
    assert.equal(res.ok, false);
    assert.equal(res.error.code, "TINYFISH_API_ERROR");
    assert.equal(res.error.message, ERR_MSG_FAILED);
  });

  test("normalizes fields with snippet fallback from description and ignores non-numeric score", async () => {
    const mockClient = {
      search: {
        query: async () => ({
          results: [
            {
              title: "Result 1",
              url: "https://example.com/1",
              description: "Fallback description used as snippet",
              score: "high",
            },
            {
              title: "Result 2",
              url: "https://example.com/2",
              snippet: "Direct snippet",
              description: "Ignored description",
              score: 0.95,
            },
            {
              title: "Result 3",
              url: "https://example.com/3",
              score: 0,
            },
            null,
          ],
        }),
      },
      fetch: {} as any,
    };

    const res = await tinyfish_search(
      { objective: "find documentation" },
      { apiKey: "test-key", clientFactory: () => mockClient },
    );

    assert.equal(res.ok, true);
    assert.equal(res.data.results.length, 4);

    assert.deepEqual(res.data.results[0], {
      title: "Result 1",
      url: "https://example.com/1",
      snippet: "Fallback description used as snippet",
      score: undefined,
    });

    assert.deepEqual(res.data.results[1], {
      title: "Result 2",
      url: "https://example.com/2",
      snippet: "Direct snippet",
      score: 0.95,
    });

    assert.deepEqual(res.data.results[2], {
      title: "Result 3",
      url: "https://example.com/3",
      snippet: "",
      score: 0,
    });

    assert.deepEqual(res.data.results[3], {
      title: "",
      url: "",
      snippet: "",
      score: undefined,
    });
  });
});
