import type { OperationResult, ToolError } from "./types.js";

export class TokenBucket {
  private capacity: number;
  private refillRatePerSec: number;
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
    while (!this.tryRemove(tokens)) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
}

export const searchBucket = new TokenBucket({ capacity: 30, refillRatePerSec: 0.5 });
export const extractBucket = new TokenBucket({ capacity: 150, refillRatePerSec: 2.5 });

export async function withRetry<T>(
  fn: (signal: AbortSignal) => Promise<OperationResult<T>>,
  options: { maxRetries?: number; baseDelayMs?: number; timeoutMs?: number } = {},
): Promise<OperationResult<T>> {
  const maxRetries = options.maxRetries ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 1000;
  const timeoutMs = options.timeoutMs ?? 10_000;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fn(controller.signal);
      clearTimeout(timer);
      if (res.ok) return res;
      if (res.error.code !== "RATE_LIMITED") return res;
    } catch (err: any) {
      clearTimeout(timer);
      const isRateLimit = err?.status === 429 || err?.message?.includes("429");
      const isTimeout = err?.name === "AbortError" || controller.signal.aborted;

      if (isTimeout) {
        return {
          ok: false,
          error: {
            code: "TINYFISH_API_ERROR",
            message: `TinyFish request timed out after ${timeoutMs}ms`,
          },
        };
      }

      if (!isRateLimit || attempt === maxRetries) {
        return {
          ok: false,
          error: {
            code: isRateLimit ? "RATE_LIMITED" : "TINYFISH_API_ERROR",
            message: isRateLimit ? "Rate limit exceeded after retries" : "TinyFish request failed",
          },
        };
      }
    }

    if (attempt === maxRetries) {
      break;
    }

    const jitter = Math.floor(Math.random() * 250);
    const delay = baseDelayMs * Math.pow(2, attempt) + jitter;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  return {
    ok: false,
    error: {
      code: "RATE_LIMITED",
      message: "Rate limit exceeded after retries",
    },
  };
}
