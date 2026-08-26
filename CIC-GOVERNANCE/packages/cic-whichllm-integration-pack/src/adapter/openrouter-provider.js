/**
 * OpenRouter Provider Adapter for CIC-WHICHLLM
 * Spec: CIC v2.4.0 | Amendment §2/S3-A1
 */

import { canonicalJson, backoffMs } from './whichllm-adapter.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const OPENROUTER_MODEL_REGISTRY = {
  'openrouter/oxalpha': {
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
  },
  'oxalpha': {
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
  },
  'openrouter/anthropic/claude-3.5-sonnet': {
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
  },
};

/**
 * @typedef {Object} OpenRouterConfig
 * @property {string} apiKey
 * @property {string} [baseUrl]
 * @property {string} [siteUrl]
 * @property {string} [appName]
 * @property {number} [maxRetries]
 */

export class OpenRouterProvider {
  #config;

  /**
   * @param {OpenRouterConfig} config
   */
  constructor(config) {
    if (!config?.apiKey) {
      throw new Error('OpenRouterProvider requires an apiKey');
    }
    this.#config = {
      baseUrl: 'https://openrouter.ai/api/v1',
      maxRetries: 2,
      siteUrl: 'https://castironpro.com',
      appName: 'CIC-TorqueQuery',
      ...config,
    };
  }

  /**
   * Execute OpenRouter completions request with deterministic retry.
   *
   * @param {Object} query
   * @param {string} query.queryId
   * @param {string} query.model
   * @param {string} query.prompt
   * @param {Array} [query.tools]
   * @param {number} [query.maxTokens]
   */
  async execute(query) {
    const meta = OPENROUTER_MODEL_REGISTRY[query.model] ?? OPENROUTER_MODEL_REGISTRY[`openrouter/${query.model}`];
    const apiSlug = meta?.apiSlug ?? query.model.replace(/^openrouter\//, '');

    const payload = {
      messages: [{ content: query.prompt, role: 'user' }],
      model: apiSlug,
      ...(query.maxTokens ? { max_tokens: query.maxTokens } : {}),
      ...(query.tools ? { tools: query.tools } : {}),
    };

    const requestBody = canonicalJson(payload);
    const maxRetries = this.#config.maxRetries;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const start = performance.now();
      try {
        const response = await fetch(`${this.#config.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.#config.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': this.#config.siteUrl,
            'X-Title': this.#config.appName,
          },
          body: requestBody,
        });

        const latencyMs = Math.round(performance.now() - start);

        if (!response.ok) {
          const errBody = await response.text();
          const isRetryable = response.status === 429 || response.status >= 500;

          if (isRetryable && attempt < maxRetries) {
            const delay = backoffMs(attempt);
            await sleep(delay);
            continue;
          }
          throw new Error(`OpenRouter HTTP ${response.status} (attempt ${attempt + 1}/${maxRetries + 1}): ${errBody}`);
        }

        const data = await response.json();
        const inputTokens = data.usage?.prompt_tokens ?? 0;
        const outputTokens = data.usage?.completion_tokens ?? 0;
        const rateCard = meta ?? { inputCostPer1M: 0, outputCostPer1M: 0 };
        const costUsd = (inputTokens / 1_000_000) * rateCard.inputCostPer1M + (outputTokens / 1_000_000) * rateCard.outputCostPer1M;

        return {
          model: query.model,
          response: data.choices?.[0]?.message?.content ?? '',
          toolCalls: data.choices?.[0]?.message?.tool_calls ?? [],
          usage: { inputTokens, outputTokens, costUsd },
          latencyMs,
          payload,
          rawResponse: data,
        };
      } catch (err) {
        if (attempt >= maxRetries) throw err;
        const delay = backoffMs(attempt);
        await sleep(delay);
      }
    }
  }
}

export default OpenRouterProvider;
