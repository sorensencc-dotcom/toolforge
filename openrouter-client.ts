import { resolveApiKey } from './credential-resolver';

export interface OpenRouterQueryOptions {
  model: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature?: number;
  maxTokens?: number;
}

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

// Global default concurrency pool (bounded to 3 concurrent requests)
export const defaultOpenRouterPool = new ConcurrencyPool(3);

const MAX_RETRIES = 3;

function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status < 600);
}

function calculateBackoffDelayMs(attempt: number): number {
  return Math.pow(attempt, 2) * 500;
}

export async function runTorqueQueryOpenRouter(
  options: OpenRouterQueryOptions,
  pool: ConcurrencyPool = defaultOpenRouterPool
): Promise<any> {
  return pool.run(async () => {
    const apiKey = resolveApiKey('openrouter');
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
      try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://rewritelabs.com',
            'X-Title': 'whichllm-torquequery',
          },
          body: JSON.stringify({
            model: options.model,
            messages: options.messages,
            temperature: options.temperature ?? 0.2,
            max_tokens: options.maxTokens,
          }),
        });

        if (response.ok) {
          return await response.json();
        }

        const errText = await response.text();
        const status = response.status;
        const error = new Error(`[OpenRouter ${status}] ${errText}`);

        if (!isRetryableStatus(status) || attempt > MAX_RETRIES) {
          throw error;
        }

        lastError = error;
      } catch (err: any) {
        // If error was thrown intentionally as non-retryable or past max retries, rethrow
        if (err.message && err.message.startsWith('[OpenRouter') && !isRetryableStatus(parseInt(err.message.match(/\[OpenRouter (\d+)\]/)?.[1] || '0', 10))) {
          throw err;
        }
        if (attempt > MAX_RETRIES) {
          throw err;
        }
        lastError = err instanceof Error ? err : new Error(String(err));
      }

      // Exponential backoff: attempt^2 * 500ms
      const delayMs = calculateBackoffDelayMs(attempt);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    throw lastError || new Error(`[OpenRouter] Failed after ${MAX_RETRIES} retries`);
  });
}

/**
 * Execute a batch of OpenRouter queries bounded by concurrency.
 */
export async function runTorqueQueryOpenRouterBatch(
  requests: OpenRouterQueryOptions[],
  pool: ConcurrencyPool = defaultOpenRouterPool
): Promise<any[]> {
  return Promise.all(requests.map((req) => runTorqueQueryOpenRouter(req, pool)));
}

