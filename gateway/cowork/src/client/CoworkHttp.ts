/**
 * HTTP transport layer for Cowork API.
 * Handles retries, backoff, error normalization.
 */

import { NetworkError } from '../utils/errors';
import { Logger } from '../utils/logger';

interface HttpOptions {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH';
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
  retries?: number;
}

interface HttpResponse<T> {
  status: number;
  data: T;
  headers: Record<string, string>;
}

class CoworkHttp {
  private logger: Logger;
  private readonly retryDelays = [100, 300, 1000]; // ms for backoff

  constructor(private baseUrl: string) {
    this.logger = new Logger('CoworkHttp');
  }

  async request<T>(
    path: string,
    options: HttpOptions,
  ): Promise<HttpResponse<T>> {
    const url = `${this.baseUrl}${path}`;
    const maxRetries = options.retries ?? 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await this.fetchWithTimeout(url, options);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new NetworkError(
            `HTTP ${response.status}: ${JSON.stringify(errorData)}`,
            response.status >= 500 || response.status === 429,
          );
        }

        const data = await response.json();
        this.logger.debug('Request succeeded', { path, status: response.status });

        return {
          status: response.status,
          data: data as T,
          headers: Object.fromEntries(response.headers.entries()),
        };
      } catch (error) {
        lastError = error as Error;
        const shouldRetry = error instanceof NetworkError && error.retryable;

        if (shouldRetry && attempt < maxRetries - 1) {
          const delay = this.retryDelays[attempt] || 1000;
          this.logger.warn('Request failed, retrying', {
            path,
            attempt: attempt + 1,
            delay,
            error: lastError.message,
          });
          await this.sleep(delay);
        } else {
          this.logger.error('Request failed (no retries left)', lastError, { path });
          throw lastError;
        }
      }
    }

    throw lastError || new NetworkError('Unknown error');
  }

  private async fetchWithTimeout(url: string, options: HttpOptions): Promise<Response> {
    const timeout = options.timeout || 30000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      return await fetch(url, {
        method: options.method,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export { CoworkHttp, HttpResponse, HttpOptions };
