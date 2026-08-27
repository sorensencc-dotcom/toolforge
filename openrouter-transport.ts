/**
 * Shared OpenRouter transport for the Toolforge / TorqueQuery runtime.
 *
 * Canonical implementation — both the TS runtime (openrouter-client.ts) and
 * the JS CIC pack (openrouter-provider.js) implement the same retry contract
 * described here.  When the CIC pack migrates to TS it will import this module
 * directly.
 *
 * Contract:
 *  - MAX_RETRIES (3) sequential attempts for 429 / 5xx responses.
 *  - Deterministic exponential backoff: attempt² × 500 ms.
 *  - 30 s AbortSignal timeout per request.
 *  - Throws OpenRouterEmptyResponseError when choices[] is empty/absent.
 *  - Never retries on 4xx client errors (except 429).
 */

export interface OpenRouterTransportOptions {
  model: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature?: number;
  maxTokens?: number;
}

export interface OpenRouterTransportConfig {
  apiKey: string;
  baseUrl?: string;
  /** HTTP-Referer header value sent to OpenRouter. */
  siteUrl?: string;
  /** X-Title header value sent to OpenRouter. */
  appName?: string;
  /** Maximum sequential attempts (default 3). */
  maxRetries?: number;
  /** Per-request timeout in ms (default 30 000). */
  timeoutMs?: number;
}

// ─── Errors ──────────────────────────────────────────────────────────────────

export class OpenRouterEmptyResponseError extends Error {
  constructor(model: string) {
    super(
      `[OpenRouter] Empty choices[] in response for model "${model}". ` +
        'Possible causes: content filter, context-length overflow, or model routing failure.'
    );
    this.name = 'OpenRouterEmptyResponseError';
  }
}

// ─── Concurrency pool ─────────────────────────────────────────────────────────

export class ConcurrencyPool {
  private activeCount = 0;
  private queue: Array<() => void> = [];

  constructor(private readonly limit: number = 3) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    const release = await this.acquire();
    try {
      return await fn();
    } finally {
      release();
    }
  }

  private async acquire(): Promise<() => void> {
    if (this.activeCount < this.limit) {
      this.activeCount++;
      let released = false;
      return () => {
        if (!released) {
          released = true;
          this.release();
        }
      };
    }

    return new Promise<() => void>((resolve) => {
      this.queue.push(() => {
        this.activeCount++;
        let released = false;
        resolve(() => {
          if (!released) {
            released = true;
            this.release();
          }
        });
      });
    });
  }

  private release(): void {
    this.activeCount--;
    if (this.queue.length > 0 && this.activeCount < this.limit) {
      const next = this.queue.shift();
      if (next) next();
    }
  }

  get active(): number {
    return this.activeCount;
  }

  get pending(): number {
    return this.queue.length;
  }
}

/** Global default concurrency pool (3 concurrent requests). */
export const defaultOpenRouterPool = new ConcurrencyPool(3);

// ─── Transport helpers ────────────────────────────────────────────────────────

const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 500;
const DEFAULT_TIMEOUT_MS = 30_000;

function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status < 600);
}

function calculateBackoffDelayMs(attempt: number): number {
  return Math.min(attempt * attempt * BASE_BACKOFF_MS, 10_000);
}

// ─── Core dispatch ────────────────────────────────────────────────────────────

/**
 * Execute a single OpenRouter chat-completion request with retry,
 * concurrency bounding, and AbortSignal timeout.
 */
export async function runOpenRouterRequest(
  options: OpenRouterTransportOptions,
  config: OpenRouterTransportConfig,
  pool: ConcurrencyPool = defaultOpenRouterPool
): Promise<any> {
  return pool.run(async () => {
    const {
      baseUrl = 'https://openrouter.ai/api/v1',
      siteUrl = 'https://castironpro.com',
      appName = 'toolforge-torquequery',
      maxRetries = MAX_RETRIES,
      timeoutMs = DEFAULT_TIMEOUT_MS,
    } = config;

    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': siteUrl,
            'X-Title': appName,
          },
          body: JSON.stringify({
            model: options.model,
            messages: options.messages,
            temperature: options.temperature ?? 0.2,
            ...(options.maxTokens !== undefined ? { max_tokens: options.maxTokens } : {}),
          }),
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (!response.ok) {
          const errText = await response.text().catch(() => '');
          const status = response.status;

          if (!isRetryableStatus(status) || attempt > maxRetries) {
            throw new Error(`[OpenRouter ${status}] ${errText}`);
          }

          lastError = new Error(`[OpenRouter ${status}] ${errText}`);
          const delayMs = calculateBackoffDelayMs(attempt);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }

        const data = await response.json();

        // Guard: empty choices is a data-integrity failure (cost may have been
        // incurred, but the result cannot be used).  Callers that legitimately
        // expect zero-content responses should catch OpenRouterEmptyResponseError.
        // This is NOT retryable.
        if (!data.choices || data.choices.length === 0) {
          const emptyErr = new OpenRouterEmptyResponseError(options.model);
          (emptyErr as any).retryable = false;
          throw emptyErr;
        }

        return data;
      } catch (err: any) {
        clearTimeout(timer);

        // AbortError = timeout; any other Error not from an explicit throw is
        // a network-level failure — both are retryable.
        // Errors with retryable===false (e.g. OpenRouterEmptyResponseError,
        // non-retryable HTTP codes) are surfaced immediately.
        if (err.retryable === false || attempt > maxRetries) {
          throw err instanceof Error ? err : new Error(String(err));
        }
        lastError = err instanceof Error ? err : new Error(String(err));
      }

      const delayMs = calculateBackoffDelayMs(attempt);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    throw lastError ?? new Error(`[OpenRouter] Failed after ${maxRetries} retries`);
  });
}

/**
 * Execute a batch of OpenRouter requests bounded by concurrency.
 */
export async function runOpenRouterBatch(
  requests: OpenRouterTransportOptions[],
  config: OpenRouterTransportConfig,
  pool: ConcurrencyPool = defaultOpenRouterPool
): Promise<any[]> {
  return Promise.all(requests.map((req) => runOpenRouterRequest(req, config, pool)));
}
