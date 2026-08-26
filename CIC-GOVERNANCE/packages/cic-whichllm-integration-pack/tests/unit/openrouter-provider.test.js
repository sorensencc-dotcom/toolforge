import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { OpenRouterProvider, OPENROUTER_MODEL_REGISTRY } from '../../src/adapter/openrouter-provider.js';
import { WhichLLMAdapter } from '../../src/adapter/whichllm-adapter.js';

describe('OpenRouterProvider Unit Tests', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('constructor requires apiKey', () => {
    assert.throws(() => new OpenRouterProvider({}), /apiKey/);
    assert.doesNotThrow(() => new OpenRouterProvider({ apiKey: 'test-key' }));
  });

  test('execute completes request successfully and calculates zero cost for free model', async () => {
    let capturedUrl;
    let capturedHeaders;
    let capturedBody;

    globalThis.fetch = async (url, opts) => {
      capturedUrl = url;
      capturedHeaders = opts.headers;
      capturedBody = JSON.parse(opts.body);

      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: 'Ox Alpha completion' } }],
          usage: { prompt_tokens: 100, completion_tokens: 50 },
        }),
      };
    };

    const provider = new OpenRouterProvider({ apiKey: 'test-key' });
    const result = await provider.execute({
      queryId: 'q-100',
      model: 'openrouter/oxalpha',
      prompt: 'Hello Ox Alpha',
    });

    assert.equal(capturedUrl, 'https://openrouter.ai/api/v1/chat/completions');
    assert.equal(capturedHeaders['Authorization'], 'Bearer test-key');
    assert.equal(capturedBody.model, 'oxalpha');
    assert.equal(capturedBody.messages[0].content, 'Hello Ox Alpha');

    assert.equal(result.model, 'openrouter/oxalpha');
    assert.equal(result.response, 'Ox Alpha completion');
    assert.equal(result.usage.inputTokens, 100);
    assert.equal(result.usage.outputTokens, 50);
    assert.equal(result.usage.costUsd, 0.0);
    assert.ok(result.payload);
  });

  test('execute retries on HTTP 429 rate limit', async () => {
    let attempts = 0;

    globalThis.fetch = async () => {
      attempts++;
      if (attempts === 1) {
        return { ok: false, status: 429, text: async () => 'Rate limit' };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: 'Success after retry' } }],
          usage: { prompt_tokens: 10, completion_tokens: 10 },
        }),
      };
    };

    const provider = new OpenRouterProvider({ apiKey: 'test-key', maxRetries: 1 });
    const result = await provider.execute({
      queryId: 'q-retry',
      model: 'oxalpha',
      prompt: 'Retry test',
    });

    assert.equal(attempts, 2);
    assert.equal(result.response, 'Success after retry');
  });

  test('execute throws error when retries are exhausted on HTTP 429', async () => {
    let attempts = 0;
    globalThis.fetch = async () => {
      attempts++;
      return { ok: false, status: 429, text: async () => 'Rate limit exceeded' };
    };

    const provider = new OpenRouterProvider({ apiKey: 'test-key', maxRetries: 1 });
    await assert.rejects(
      () => provider.execute({ queryId: 'q-exhaus', model: 'oxalpha', prompt: 'Exhaust retries' }),
      /OpenRouter HTTP 429 \(attempt 2\/2\): Rate limit exceeded/
    );
    assert.equal(attempts, 2);
  });

  test('execute throws network error after maxRetries', async () => {
    let attempts = 0;
    globalThis.fetch = async () => {
      attempts++;
      throw new Error('Network connection reset');
    };

    const provider = new OpenRouterProvider({ apiKey: 'test-key', maxRetries: 1 });
    await assert.rejects(
      () => provider.execute({ queryId: 'q-net-err', model: 'oxalpha', prompt: 'Network fail' }),
      /Network connection reset/
    );
    assert.equal(attempts, 2);
  });

  test('WhichLLMAdapter integrates OpenRouterProvider cleanly', async () => {
    globalThis.fetch = async (url) => {
      if (url.includes('openrouter.ai')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{ message: { content: 'OpenRouter response' } }],
            usage: { prompt_tokens: 20, completion_tokens: 30 },
          }),
        };
      }
      return { ok: false, status: 500, text: async () => 'Not openrouter' };
    };

    const adapter = new WhichLLMAdapter({
      apiEndpoint: 'https://whichllm.local',
      apiKey: 'local-key',
      harvesterId: 'cic-whichllm-default-v1',
      openRouterApiKey: 'or-key',
    });

    const result = await adapter.query({
      queryId: 'q-integration-1',
      model: 'openrouter/oxalpha',
      prompt: 'Integration test prompt',
    });

    assert.equal(result.model, 'openrouter/oxalpha');
    assert.equal(result.response, 'OpenRouter response');
    assert.equal(result.governance.status, 'passed');
    assert.ok(result.lineageHash);
    assert.equal(result.lineageHash.length, 64);
  });
});
