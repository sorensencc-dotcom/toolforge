import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { TokenBucket, withRetry } from "../src/limiter.js";

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
    }
    assert.equal(attempts, 3); // initial attempt + 2 retries
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
      assert.match(result.error.message, /timed out after 50ms/);
    }
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
