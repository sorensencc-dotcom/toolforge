import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { OpenRouterProvider, OPENROUTER_MODEL_REGISTRY } from '../../src/adapter/openrouter-provider.js';
import { WhichLLMAdapter } from '../../src/adapter/whichllm-adapter.js';
import { GovernanceWrapper } from '../../src/governance/governance-wrapper.js';

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

describe('OpenRouterProvider — additional coverage', () => {
  let originalFetch;

  beforeEach(() => { originalFetch = globalThis.fetch; });
  afterEach(() => { globalThis.fetch = originalFetch; });

  // ── Retry behaviour ─────────────────────────────────────────────────────────

  test('execute retries on HTTP 500 server error', async () => {
    let attempts = 0;
    globalThis.fetch = async () => {
      attempts++;
      if (attempts === 1) {
        return { ok: false, status: 500, text: async () => 'Internal Server Error' };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: 'Recovered' } }],
          usage: { prompt_tokens: 5, completion_tokens: 5 },
        }),
      };
    };

    const provider = new OpenRouterProvider({ apiKey: 'test-key', maxRetries: 1 });
    const result = await provider.execute({ queryId: 'q-500-retry', model: 'oxalpha', prompt: 'test' });

    assert.equal(attempts, 2);
    assert.equal(result.response, 'Recovered');
  });

  test('execute does NOT retry on HTTP 400 client error', async () => {
    let attempts = 0;
    globalThis.fetch = async () => {
      attempts++;
      return { ok: false, status: 400, text: async () => 'Bad Request' };
    };

    const provider = new OpenRouterProvider({ apiKey: 'test-key', maxRetries: 3 });
    await assert.rejects(
      () => provider.execute({ queryId: 'q-400', model: 'oxalpha', prompt: 'bad' }),
      /OpenRouter HTTP 400/
    );
    // Should have thrown immediately on first attempt — no retries for 4xx
    assert.equal(attempts, 1);
  });

  // ── Empty choices guard ──────────────────────────────────────────────────────

  test('execute throws on empty choices[] in 200 response', async () => {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ choices: [], usage: { prompt_tokens: 10, completion_tokens: 0 } }),
    });

    const provider = new OpenRouterProvider({ apiKey: 'test-key' });
    await assert.rejects(
      () => provider.execute({ queryId: 'q-empty', model: 'oxalpha', prompt: 'trigger empty' }),
      /Empty choices\[\]/
    );
  });

  // ── Registry ─────────────────────────────────────────────────────────────────

  test('OPENROUTER_MODEL_REGISTRY aliases reference the same object (no copy-paste drift)', () => {
    assert.strictEqual(
      OPENROUTER_MODEL_REGISTRY['openrouter/oxalpha'],
      OPENROUTER_MODEL_REGISTRY['oxalpha'],
      'oxalpha and openrouter/oxalpha must be the same object reference'
    );
    assert.strictEqual(
      OPENROUTER_MODEL_REGISTRY['openrouter/anthropic/claude-3.5-sonnet'],
      OPENROUTER_MODEL_REGISTRY['anthropic/claude-3.5-sonnet'],
      'anthropic short alias and full path must be the same object reference'
    );
  });

  test('execute uses fallback slug derivation for models not in registry', async () => {
    let capturedBody;
    globalThis.fetch = async (_, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: 'ok' } }],
          usage: { prompt_tokens: 1, completion_tokens: 1 },
        }),
      };
    };

    const provider = new OpenRouterProvider({ apiKey: 'test-key' });
    await provider.execute({ queryId: 'q-unknown', model: 'openrouter/some-new-model', prompt: 'hi' });

    // Fallback strips the 'openrouter/' prefix to derive the apiSlug
    assert.equal(capturedBody.model, 'some-new-model');
  });
});

describe('GovernanceWrapper — MODEL_ALLOWLIST coverage for new entries', () => {
  function makeWrapper() {
    return new GovernanceWrapper({
      harvesterId: 'cic-whichllm-default-v1',
      specVersion: '2.4.0',
      amendmentRef: '§2/S3-A1',
    });
  }

  test('oxalpha standalone slug passes GC-04 model allowlist', async () => {
    const wrapper = makeWrapper();
    const ctx = {
      query: { queryId: 'q-gc04-oxalpha', prompt: 'test' },
      result: { model: 'oxalpha', response: 'ok', rawMeta: {} },
      lineageHash: 'a'.repeat(64),
    };
    // attest() runs GC-04 — should not throw
    await assert.doesNotReject(() => wrapper.attest(ctx));
  });

  test('unlisted model string fails GC-04 model allowlist in strict mode', async () => {
    const wrapper = makeWrapper();
    const ctx = {
      query: { queryId: 'q-gc04-bad', prompt: 'test' },
      result: { model: 'totally-unapproved-model-xyz', response: 'ok', rawMeta: {} },
      lineageHash: 'b'.repeat(64),
    };
    await assert.rejects(
      () => wrapper.attest(ctx),
      /GovernanceViolationError|not on the CIC MODEL_ALLOWLIST/
    );
  });
});
