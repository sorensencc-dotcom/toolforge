import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  tinyfish_extract,
  ERR_MSG_INVALID_INPUT,
  ERR_MSG_INVALID_API_RESPONSE,
  ERR_MSG_EXTRACT_FAILED,
} from "../src/extract.js";
import { ERR_MSG_API_KEY_MISSING } from "../src/client.js";
import { ERR_MSG_FAILED } from "../src/limiter.js";

describe("tinyfish_extract", () => {
  test("fails closed when URLs are missing, invalid, or exceed limit", async () => {
    const resEmpty = await tinyfish_extract({ urls: [] }, { apiKey: "test-key" });
    assert.equal(resEmpty.ok, false);
    assert.equal(resEmpty.error.code, "INVALID_INPUT");
    assert.equal(resEmpty.error.message, ERR_MSG_INVALID_INPUT);

    const resInvalid = await tinyfish_extract({ urls: ["not-a-url"] }, { apiKey: "test-key" });
    assert.equal(resInvalid.ok, false);
    assert.equal(resInvalid.error.code, "INVALID_INPUT");
    assert.equal(resInvalid.error.message, ERR_MSG_INVALID_INPUT);

    const resFtp = await tinyfish_extract({ urls: ["ftp://example.com"] }, { apiKey: "test-key" });
    assert.equal(resFtp.ok, false);
    assert.equal(resFtp.error.code, "INVALID_INPUT");
    assert.equal(resFtp.error.message, ERR_MSG_INVALID_INPUT);

    const resExceed = await tinyfish_extract(
      { urls: Array(21).fill("https://example.com") },
      { apiKey: "test-key" },
    );
    assert.equal(resExceed.ok, false);
    assert.equal(resExceed.error.code, "INVALID_INPUT");
    assert.equal(resExceed.error.message, ERR_MSG_INVALID_INPUT);

    const resNull = await tinyfish_extract(null as any, { apiKey: "test-key" });
    assert.equal(resNull.ok, false);
    assert.equal(resNull.error.code, "INVALID_INPUT");
    assert.equal(resNull.error.message, ERR_MSG_INVALID_INPUT);
  });

  test("fails closed when API key is missing", async () => {
    const original = process.env.TINYFISH_API_KEY;
    try {
      delete process.env.TINYFISH_API_KEY;
      const res = await tinyfish_extract({ urls: ["https://example.com"] });
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

  test("normalizes Markdown fetch results with mock client", async () => {
    const mockClient = {
      search: {} as any,
      fetch: {
        getContents: async () => ({
          results: [
            { url: "https://example.com/1", title: "Example 1", markdown: "# Hello World", status: 200 },
            { url: "https://example.com/2", content: "Fallback content", status: 201 },
          ],
          errors: [],
        }),
      },
    };

    const res = await tinyfish_extract(
      { urls: ["https://example.com/1", "https://example.com/2"] },
      { apiKey: "test-key", clientFactory: () => mockClient },
    );

    assert.equal(res.ok, true);
    assert.equal(res.data.results.length, 2);
    assert.equal(res.data.results[0].title, "Example 1");
    assert.equal(res.data.results[0].markdown, "# Hello World");
    assert.equal(res.data.results[0].status, 200);
    assert.equal(res.data.results[1].markdown, "Fallback content");
    assert.equal(res.data.results[1].status, 201);
    assert.equal(res.data.errors.length, 0);
  });

  test("handles partial errors from upstream response", async () => {
    const mockClient = {
      search: {} as any,
      fetch: {
        getContents: async () => ({
          results: [{ url: "https://example.com/ok", markdown: "OK", status: 200 }],
          errors: [{ url: "https://example.com/fail", error: "Not found" }],
        }),
      },
    };

    const res = await tinyfish_extract(
      { urls: ["https://example.com/ok", "https://example.com/fail"] },
      { apiKey: "test-key", clientFactory: () => mockClient },
    );

    assert.equal(res.ok, true);
    assert.equal(res.data.results.length, 1);
    assert.equal(res.data.errors.length, 1);
    assert.equal(res.data.errors[0].url, "https://example.com/fail");
    assert.equal(res.data.errors[0].error, "Not found");
  });

  test("fails closed with INVALID_API_RESPONSE on non-array results", async () => {
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
        search: {} as any,
        fetch: {
          getContents: async () => mockResponse,
        },
      };

      const res = await tinyfish_extract(
        { urls: ["https://example.com"] },
        { apiKey: "test-key", clientFactory: () => mockClient },
      );

      assert.equal(res.ok, false);
      assert.equal(res.error.code, "INVALID_API_RESPONSE");
      assert.equal(res.error.message, ERR_MSG_INVALID_API_RESPONSE);
    }
  });

  test("invokes onError and fails closed with TINYFISH_API_ERROR on fetch exception", async () => {
    let capturedError: unknown = null;
    const mockClient = {
      search: {} as any,
      fetch: {
        getContents: async () => {
          throw new Error("Network drop");
        },
      },
    };

    const res = await tinyfish_extract(
      { urls: ["https://example.com"] },
      {
        apiKey: "test-key",
        clientFactory: () => mockClient,
        onError: (err) => {
          capturedError = err;
        },
      },
    );

    assert.equal(res.ok, false);
    assert.equal(res.error.code, "TINYFISH_API_ERROR");
    assert.equal(res.error.message, ERR_MSG_FAILED);
    assert.ok(capturedError instanceof Error);
  });

  test("handles null or malformed entries in results and errors defensively", async () => {
    const mockClient = {
      search: {} as any,
      fetch: {
        getContents: async () => ({
          results: [
            null,
            { url: "https://example.com/item" },
          ],
          errors: [
            null,
            { url: "https://example.com/err" },
          ],
        }),
      },
    };

    const res = await tinyfish_extract(
      { urls: ["https://example.com"] },
      { apiKey: "test-key", clientFactory: () => mockClient },
    );

    assert.equal(res.ok, true);
    assert.equal(res.data.results.length, 2);
    assert.deepEqual(res.data.results[0], {
      url: "",
      title: undefined,
      markdown: "",
      status: 200,
    });
    assert.deepEqual(res.data.results[1], {
      url: "https://example.com/item",
      title: undefined,
      markdown: "",
      status: 200,
    });
    assert.equal(res.data.errors.length, 2);
    assert.deepEqual(res.data.errors[0], {
      url: "",
      error: ERR_MSG_EXTRACT_FAILED,
    });
    assert.deepEqual(res.data.errors[1], {
      url: "https://example.com/err",
      error: ERR_MSG_EXTRACT_FAILED,
    });
  });
});
