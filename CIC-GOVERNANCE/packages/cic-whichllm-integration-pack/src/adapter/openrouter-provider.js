/**
 * OpenRouter Provider Adapter for CIC-WHICHLLM
 * Spec: CIC v2.4.0 | Amendment §2/S3-A1
 *
 * NOTE: The canonical shared OpenRouter transport contract is defined in
 * `openrouter-transport.ts` at the repository root.  When this CIC pack
 * migrates to TypeScript it will import that module directly.  Until then,
 * this file mirrors the same retry (3 attempts), backoff (attempt² × 500 ms,
 * cap 10 s), timeout (30 s AbortSignal), and error semantics.
 */

import { createGuardedProvider } from '@cic/delivery-guard';
import { canonicalJson, backoffMs } from './whichllm-adapter.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const DEFAULT_TIMEOUT_MS = 30_000;

// ─── Model registry ───────────────────────────────────────────────────────────

const _OXALPHA = {
  modelId: 'openrouter/oxalpha',
  apiSlug: 'oxalpha',
  contextWindow: 1_050_000,
  maxOutputTokens: 131_072,
  rateCardVersion: 'openrouter-free-2026-08',
  inputCostPer1M: 0.0,
  outputCostPer1M: 0.0,
  isFree: true,
  supportsTools: true,
  tier: 'tier0_preview',
};

const _CLAUDE_35_SONNET = {
  modelId: 'openrouter/anthropic/claude-3.5-sonnet',
  apiSlug: 'anthropic/claude-3.5-sonnet',
  contextWindow: 200_000,
  maxOutputTokens: 8_192,
  rateCardVersion: 'openrouter-standard-2026-08',
  inputCostPer1M: 3.0,
  outputCostPer1M: 15.0,
  isFree: false,
  supportsTools: true,
  tier: 'tier1_frontier',
};

/**
 * Registry of known OpenRouter models.
 * Each alias (`oxalpha`, `openrouter/oxalpha`) references the SAME object so
 * cost/capability updates propagate automatically without copy-paste drift.
 */
export const OPENROUTER_MODEL_REGISTRY = {
  'openrouter/oxalpha': _OXALPHA,
  'oxalpha': _OXALPHA,                                         // short alias — same object
  'openrouter/anthropic/claude-3.5-sonnet': _CLAUDE_35_SONNET,
  'anthropic/claude-3.5-sonnet': _CLAUDE_35_SONNET,           // short alias — same object
};

// ─── Provider ─────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} OpenRouterConfig
 * @property {string} apiKey
 * @property {string} [baseUrl]
 * @property {string} [siteUrl]
 * @property {string} [appName]
 * @property {number} [maxRetries]
 * @property {number} [timeoutMs]
 * @property {Object} [budgetLedger]
 */

export class OpenRouterProvider {
  #config;
  #guardedProvider;

  /**
   * @param {OpenRouterConfig} config
   */
  constructor(config) {
    if (!config?.apiKey) {
      throw new Error('OpenRouterProvider requires an apiKey');
    }
    this.#config = {
      baseUrl: 'https://openrouter.ai/api/v1',
      maxRetries: 3,
      timeoutMs: DEFAULT_TIMEOUT_MS,
      siteUrl: 'https://castironpro.com',
      appName: 'CIC-TorqueQuery',
      ...config,
    };

    if (this.#config.budgetLedger) {
      this.#guardedProvider = createGuardedProvider(
        { execute: (q) => this.#executeRaw(q) },
        {
          ledger: this.#config.budgetLedger,
          modelRegistry: OPENROUTER_MODEL_REGISTRY,
          providerName: 'openrouter',
        }
      );
    }
  }

  /**
   * Execute OpenRouter completions request. Routes through budget guard if budgetLedger is configured.
   *
   * @param {Object} query
   */
  async execute(query) {
    if (this.#guardedProvider) {
      return this.#guardedProvider.execute(query);
    }
    return this.#executeRaw(query);
  }

  /**
   * Raw transport dispatch to OpenRouter API.
   *
   * @param {Object} query
   * @param {string} query.queryId
   * @param {string} query.model
   * @param {string} query.prompt
   * @param {Array} [query.tools]
   * @param {number} [query.maxTokens]
   */
  async #executeRaw(query) {
    const meta = OPENROUTER_MODEL_REGISTRY[query.model]
      ?? OPENROUTER_MODEL_REGISTRY[`openrouter/${query.model}`];
    const apiSlug = meta?.apiSlug ?? query.model.replace(/^openrouter\//, '');

    const payload = {
      messages: [{ content: query.prompt, role: 'user' }],
      model: apiSlug,
      ...(query.maxTokens ? { max_tokens: query.maxTokens } : {}),
      ...(query.tools ? { tools: query.tools } : {}),
    };

    const requestBody = canonicalJson(payload);
    const { maxRetries, timeoutMs } = this.#config;

    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const start = performance.now();

      try {
        const response = await fetch(`${this.#config.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.#config.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': this.#config.siteUrl,
            'X-Title': this.#config.appName,
          },
          body: requestBody,
          signal: controller.signal,
        });

        clearTimeout(timer);
        const latencyMs = Math.round(performance.now() - start);

        if (!response.ok) {
          const errBody = await response.text().catch(() => '');
          const isRetryable = response.status === 429 || response.status >= 500;

          if (isRetryable && attempt < maxRetries) {
            lastError = new Error(`OpenRouter HTTP ${response.status}: ${errBody}`);
            await sleep(backoffMs(attempt));
            continue;
          }
          throw new Error(
            `OpenRouter HTTP ${response.status} (attempt ${attempt + 1}/${maxRetries + 1}): ${errBody}`
          );
        }

        const data = await response.json();

        // Guard: empty choices[] indicates content filter, context-length
        // overflow, or routing failure.  Cost may have been incurred; the
        // result cannot be used.  This is NOT retryable.
        if (!data.choices || data.choices.length === 0) {
          const err = new Error(
            `[OpenRouter] Empty choices[] in response for model "${query.model}". ` +
              'Possible causes: content filter, context-length overflow, or model routing failure.'
          );
          err.retryable = false;
          throw err;
        }

        const inputTokens = data.usage?.prompt_tokens ?? 0;
        const outputTokens = data.usage?.completion_tokens ?? 0;
        const rateCard = meta ?? { inputCostPer1M: 0, outputCostPer1M: 0 };
        const costUsd =
          (inputTokens / 1_000_000) * rateCard.inputCostPer1M +
          (outputTokens / 1_000_000) * rateCard.outputCostPer1M;

        return {
          model: query.model,
          response: data.choices[0].message?.content ?? '',
          toolCalls: data.choices[0].message?.tool_calls ?? [],
          usage: { inputTokens, outputTokens, costUsd },
          latencyMs,
          payload,
          rawResponse: data,
        };
      } catch (err) {
        clearTimeout(timer);

        // Non-retryable errors (e.g. empty choices, 4xx client errors) are
        // surfaced immediately.
        if (err.retryable === false || attempt >= maxRetries) throw err;

        // AbortError = timeout; any other non-HTTP error = network failure.
        // Both are retryable.
        if (
          err.name === 'AbortError' ||
          !(err.message && err.message.startsWith('OpenRouter HTTP'))
        ) {
          lastError = err;
          await sleep(backoffMs(attempt));
          continue;
        }

        // Structured HTTP error thrown above — rethrow immediately.
        throw err;
      }
    }

    throw lastError ?? new Error(`OpenRouter: all ${maxRetries + 1} attempts failed`);
  }
}

export function createGuardedOpenRouterProvider(config = {}) {
  return new OpenRouterProvider(config);
}

export default OpenRouterProvider;
