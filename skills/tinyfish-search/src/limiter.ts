import type { OperationResult } from "./types.js";

export const ERR_MSG_RATE_LIMITED = "Rate limit exceeded after retries";
export const ERR_MSG_FAILED = "TinyFish request failed";
export const ERR_MSG_TIMEOUT = "TinyFish request timed out";

export class TokenBucket {
  readonly capacity: number;
  readonly refillRatePerSec: number;
  private tokens: number;
  private lastRefillTimestamp: number;

  constructor({ capacity, refillRatePerSec }: { capacity: number; refillRatePerSec: number }) {
    this.capacity = capacity;
    this.refillRatePerSec = refillRatePerSec;
    this.tokens = capacity;
    this.lastRefillTimestamp = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsedSec = (now - this.lastRefillTimestamp) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsedSec * this.refillRatePerSec);
    this.lastRefillTimestamp = now;
  }

  tryRemove(tokens = 1): boolean {
    this.refill();
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }
    return false;
  }

  async acquire(tokens = 1): Promise<void> {
    if (tokens > this.capacity || tokens <= 0) {
      throw new Error("Requested tokens exceeds bucket capacity");
    }
    while (!this.tryRemove(tokens)) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
}

export const searchBucket = new TokenBucket({ capacity: 30, refillRatePerSec: 0.5 });
export const extractBucket = new TokenBucket({ capacity: 150, refillRatePerSec: 2.5 });

export async function withRetry<T>(
  fn: (signal: AbortSignal) => Promise<OperationResult<T>>,
  options: {
    maxRetries?: number;
    baseDelayMs?: number;
    timeoutMs?: number;
    cumulativeTimeoutMs?: number;
  } = {},
): Promise<OperationResult<T>> {
  const maxRetries = options.maxRetries ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 1000;
  const timeoutMs = options.timeoutMs ?? 10_000;
  const cumulativeTimeoutMs = options.cumulativeTimeoutMs ?? 45_000;
  const startTime = Date.now();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (Date.now() - startTime >= cumulativeTimeoutMs) {
      return {
        ok: false,
        error: {
          code: "TINYFISH_API_ERROR",
          message: ERR_MSG_TIMEOUT,
        },
      };
    }

    const controller = new AbortController();
    const remainingTime = cumulativeTimeoutMs - (Date.now() - startTime);
    const effectiveTimeoutMs = Math.min(timeoutMs, Math.max(0, remainingTime));
    const timer = setTimeout(() => controller.abort(), effectiveTimeoutMs);

    try {
      const res = await fn(controller.signal);
      clearTimeout(timer);

      if (controller.signal.aborted) {
        return {
          ok: false,
          error: {
            code: "TINYFISH_API_ERROR",
            message: ERR_MSG_TIMEOUT,
          },
        };
      }

      if (res.ok) return res;
      if (res.error.code !== "RATE_LIMITED") return res;
    } catch (err: any) {
      clearTimeout(timer);
      const isRateLimit = Number(err?.status) === 429 || Number(err?.statusCode) === 429 || err?.message?.includes("429");
      const isTimeout = err?.name === "AbortError" || controller.signal.aborted;

      if (isTimeout) {
        return {
          ok: false,
          error: {
            code: "TINYFISH_API_ERROR",
            message: ERR_MSG_TIMEOUT,
          },
        };
      }

      if (!isRateLimit || attempt === maxRetries) {
        return {
          ok: false,
          error: {
            code: isRateLimit ? "RATE_LIMITED" : "TINYFISH_API_ERROR",
            message: isRateLimit ? ERR_MSG_RATE_LIMITED : ERR_MSG_FAILED,
          },
        };
      }
    }

    if (attempt === maxRetries) {
      break;
    }

    if (Date.now() - startTime >= cumulativeTimeoutMs) {
      return {
        ok: false,
        error: {
          code: "TINYFISH_API_ERROR",
          message: ERR_MSG_TIMEOUT,
        },
      };
    }

    const jitter = Math.floor(Math.random() * 250);
    const delay = baseDelayMs * Math.pow(2, attempt) + jitter;
    const remainingBeforeSleep = cumulativeTimeoutMs - (Date.now() - startTime);
    if (remainingBeforeSleep <= 0) {
      return {
        ok: false,
        error: {
          code: "TINYFISH_API_ERROR",
          message: ERR_MSG_TIMEOUT,
        },
      };
    }
    await new Promise((resolve) => setTimeout(resolve, Math.min(delay, remainingBeforeSleep)));
  }

  return {
    ok: false,
    error: {
      code: "RATE_LIMITED",
      message: ERR_MSG_RATE_LIMITED,
    },
  };
}
