/**
 * TorqueQuery OpenRouter runtime client.
 *
 * Thin wrapper over the canonical shared transport (`openrouter-transport.ts`).
 * All retry, timeout, concurrency, and error-handling logic lives there.
 */

import { resolveApiKey } from './credential-resolver';
import {
  runOpenRouterRequest,
  runOpenRouterBatch,
  ConcurrencyPool,
  defaultOpenRouterPool,
} from './openrouter-transport';

export type { ConcurrencyPool };
export { defaultOpenRouterPool };
export { OpenRouterEmptyResponseError } from './openrouter-transport';

export interface OpenRouterQueryOptions {
  model: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature?: number;
  maxTokens?: number;
}

export async function runTorqueQueryOpenRouter(
  options: OpenRouterQueryOptions,
  pool: ConcurrencyPool = defaultOpenRouterPool
): Promise<any> {
  return runOpenRouterRequest(options, { apiKey: resolveApiKey('openrouter') }, pool);
}

export async function runTorqueQueryOpenRouterBatch(
  requests: OpenRouterQueryOptions[],
  pool: ConcurrencyPool = defaultOpenRouterPool
): Promise<any[]> {
  return runOpenRouterBatch(requests, { apiKey: resolveApiKey('openrouter') }, pool);
}
