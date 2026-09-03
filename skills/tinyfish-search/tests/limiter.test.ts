import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  TokenBucket,
  searchBucket,
  extractBucket,
  withRetry,
  ERR_MSG_RATE_LIMITED,
  ERR_MSG_FAILED,
  ERR_MSG_TIMEOUT,
} from "../src/limiter.js";

describe("TokenBucket", () => {
  test("consumes tokens and throttles when depleted", async () => {
    const bucket = new TokenBucket({ capacity: 2, refillRatePerSec: 10 });
    assert.equal(bucket.tryRemove(1), true);
    assert.equal(bucket.tryRemove(1), true);
    assert.equal(bucket.tryRemove(1), false);
  });

  test("acquire waits until tokens refill", async () => {
    const bucket = new TokenBucket({ capacity: 1, refillRatePerSec: 20 });
    assert.equal(bucket.tryRemove(1), true);
    assert.equal(bucket.tryRemove(1), false);

    const start = Date.now();
    await bucket.acquire(1);
    const elapsed = Date.now() - start;
    assert.ok(elapsed >= 40, `Expected elapsed >= 40ms, got ${elapsed}ms`);
  });

  test("acquire throws error when requested tokens exceed capacity or are non-positive", async () => {
    const bucket = new TokenBucket({ capacity: 5, refillRatePerSec: 1 });
    await assert.rejects(
      async () => bucket.acquire(6),
      /Requested tokens exceeds bucket capacity/
    );
    await assert.rejects(
      async () => bucket.acquire(0),
      /Requested tokens exceeds bucket capacity/
    );
    await assert.rejects(
      async () => bucket.acquire(-1),
      /Requested tokens exceeds bucket capacity/
    );
  });

  test("searchBucket and extractBucket have expected configurations", () => {
    assert.equal(searchBucket.capacity, 30);
    assert.equal(searchBucket.refillRatePerSec, 0.5);
    assert.equal(extractBucket.capacity, 150);
    assert.equal(extractBucket.refillRatePerSec, 2.5);
  });
});

describe("withRetry", () => {
  test("retries on 429 status up to max attempts", async () => {
    let attempts = 0;
    const result = await withRetry(async () => {
      attempts++;
      if (attempts < 3) {
        const err = new Error("Rate limit");
        (err as any).status = 429;
        throw err;
      }
      return { ok: true as const, data: "success" };
    }, { maxRetries: 3, baseDelayMs: 10 });

    assert.equal(result.ok, true);
    assert.equal(attempts, 3);
  });

  test("retries on string status code '429' via coercion", async () => {
    let attempts = 0;
    const result = await withRetry(async () => {
      attempts++;
      if (attempts < 2) {
        const err = new Error("Rate limit");
        (err as any).status = "429";
        throw err;
      }
      return { ok: true as const, data: "success" };
    }, { maxRetries: 2, baseDelayMs: 10 });

    assert.equal(result.ok, true);
    assert.equal(attempts, 2);
  });

  test("returns RATE_LIMITED error when max retries exceeded on 429", async () => {
    let attempts = 0;
    const result = await withRetry(async () => {
      attempts++;
      const err = new Error("429 Too Many Requests");
      (err as any).status = 429;
      throw err;
    }, { maxRetries: 2, baseDelayMs: 10 });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, "RATE_LIMITED");
      assert.equal(result.error.message, ERR_MSG_RATE_LIMITED);
    }
    assert.equal(attempts, 3); // initial attempt + 2 retries
  });

  test("returns TINYFISH_API_ERROR with ERR_MSG_FAILED on non-retryable failure", async () => {
    const result = await withRetry(async () => {
      const err = new Error("Bad Request");
      (err as any).status = 400;
      throw err;
    }, { maxRetries: 2 });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, "TINYFISH_API_ERROR");
      assert.equal(result.error.message, ERR_MSG_FAILED);
    }
  });

  test("handles timeout abort error cleanly", async () => {
    const result = await withRetry(
      async (signal) => {
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            resolve({ ok: true, data: "done" });
          }, 200);
          signal.addEventListener("abort", () => {
            clearTimeout(timer);
            const err = new Error("This operation was aborted");
            err.name = "AbortError";
            reject(err);
          });
        });
      },
      { maxRetries: 1, timeoutMs: 50, baseDelayMs: 10 }
    );

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, "TINYFISH_API_ERROR");
      assert.equal(result.error.message, ERR_MSG_TIMEOUT);
    }
  });

  test("returns timeout error if controller signal was aborted after fn resolves", async () => {
    const result = await withRetry(
      async (signal) => {
        await new Promise((resolve) => {
          signal.addEventListener("abort", resolve);
        });
        return { ok: true as const, data: "late-success" };
      },
      { maxRetries: 0, timeoutMs: 30 }
    );

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, "TINYFISH_API_ERROR");
      assert.equal(result.error.message, ERR_MSG_TIMEOUT);
    }
  });

  test("aborts when cumulative timeout ceiling is exceeded across retries", async () => {
    let attempts = 0;
    const start = Date.now();
    const result = await withRetry(
      async () => {
        attempts++;
        const err = new Error("429 Too Many Requests");
        (err as any).status = 429;
        throw err;
      },
      { maxRetries: 5, baseDelayMs: 40, cumulativeTimeoutMs: 60 }
    );

    const elapsed = Date.now() - start;
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, "TINYFISH_API_ERROR");
      assert.equal(result.error.message, ERR_MSG_TIMEOUT);
    }
    assert.ok(attempts < 5, `Expected attempts < 5, got ${attempts}`);
    assert.ok(elapsed >= 50, `Expected elapsed >= 50ms, got ${elapsed}ms`);
  });

  test("retries when returning ok: false with RATE_LIMITED error code", async () => {
    let attempts = 0;
    const result = await withRetry(
      async () => {
        attempts++;
        if (attempts < 2) {
          return {
            ok: false as const,
            error: {
              code: "RATE_LIMITED" as const,
              message: "Rate limit reached",
            },
          };
        }
        return { ok: true as const, data: "recovered" };
      },
      { maxRetries: 2, baseDelayMs: 10 }
    );

    assert.equal(result.ok, true);
    assert.equal(attempts, 2);
  });
});

