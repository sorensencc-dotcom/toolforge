/**
 * Unit Tests — WhichLLMAdapter
 * CIC-WHICHLLM-INTEGRATION-PACK v1.0
 *
 * Runner: Node 20+ built-in test runner  (node --test)
 * Coverage targets: adapter hot-paths, determinism contract, error handling
 */

import { describe, it, before, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import {
  WhichLLMAdapter,
  deriveId,
  canonicalJson,
  backoffMs,
  ADAPTER_VERSION,
  CIC_SPEC_VERSION,
  AMENDMENT_REF,
} from '../../src/adapter/whichllm-adapter.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALID_CONFIG = {
  apiEndpoint: 'https://api.whichllm.test',
  apiKey: 'test-key-abc123',
  harvesterId: 'cic-whichllm-default-v1',
  tenantId: 'tenant-unit-test',
};

const VALID_QUERY = {
  queryId: 'qry-unit-001',
  prompt: 'What is the capital of France?',
  modelHints: ['gpt-4o'],
  meta: { environment: 'test' },
};

function sha256hex(str) {
  return createHash('sha256').update(str, 'utf8').digest('hex');
}

function makeFetchMock(response, status = 200) {
  return async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => response,
    text: async () => JSON.stringify(response),
  });
}

// ─── deriveId ─────────────────────────────────────────────────────────────────

describe('deriveId()', () => {
  it('produces consistent 64-char hex for the same input', () => {
    const id1 = deriveId({ a: 1, b: 2 });
    const id2 = deriveId({ a: 1, b: 2 });
    assert.equal(id1, id2);
    assert.match(id1, /^[0-9a-f]{64}$/);
  });

  it('is key-order independent (canonical)', () => {
    const id1 = deriveId({ b: 2, a: 1 });
    const id2 = deriveId({ a: 1, b: 2 });
    assert.equal(id1, id2);
  });

  it('produces different IDs for different content', () => {
    assert.notEqual(deriveId({ a: 1 }), deriveId({ a: 2 }));
  });

  it('handles nested objects deterministically', () => {
    const id1 = deriveId({ x: { z: 3, y: 2 } });
    const id2 = deriveId({ x: { y: 2, z: 3 } });
    assert.equal(id1, id2);
  });

  it('handles arrays (preserves order)', () => {
    assert.notEqual(deriveId([1, 2, 3]), deriveId([3, 2, 1]));
  });
});

// ─── canonicalJson ────────────────────────────────────────────────────────────

describe('canonicalJson()', () => {
  it('sorts keys at all nesting levels', () => {
    const result = canonicalJson({ z: 1, a: 2, m: { z: 3, a: 4 } });
    assert.equal(result, '{"a":2,"m":{"a":4,"z":3},"z":1}');
  });

  it('handles null values', () => {
    assert.equal(canonicalJson({ a: null }), '{"a":null}');
  });

  it('handles arrays with objects', () => {
    const result = canonicalJson([{ b: 1, a: 2 }]);
    assert.equal(result, '[{"a":2,"b":1}]');
  });
});

// ─── backoffMs ────────────────────────────────────────────────────────────────

describe('backoffMs()', () => {
  it('returns deterministic schedule for each attempt index', () => {
    assert.equal(backoffMs(0), 500);   // 500 * 1^2
    assert.equal(backoffMs(1), 2_000); // 500 * 2^2
    assert.equal(backoffMs(2), 4_500); // 500 * 3^2
  });

  it('caps at 10 000 ms', () => {
    assert.equal(backoffMs(10), 10_000);
    assert.equal(backoffMs(99), 10_000);
  });
});

// ─── WhichLLMAdapter — Construction ───────────────────────────────────────────

describe('WhichLLMAdapter construction', () => {
  it('instantiates with valid config', () => {
    const adapter = new WhichLLMAdapter(VALID_CONFIG);
    assert.ok(adapter);
  });

  it('throws when apiEndpoint is missing', () => {
    const { apiEndpoint: _, ...cfg } = VALID_CONFIG;
    assert.throws(() => new WhichLLMAdapter(cfg), /apiEndpoint/);
  });

  it('throws when apiKey is missing', () => {
    const { apiKey: _, ...cfg } = VALID_CONFIG;
    assert.throws(() => new WhichLLMAdapter(cfg), /apiKey/);
  });

  it('throws when harvesterId is missing', () => {
    const { harvesterId: _, ...cfg } = VALID_CONFIG;
    assert.throws(() => new WhichLLMAdapter(cfg), /harvesterId/);
  });

  it('throws when apiEndpoint is not a URL', () => {
    assert.throws(
      () => new WhichLLMAdapter({ ...VALID_CONFIG, apiEndpoint: 'not-a-url' }),
      /absolute URL/
    );
  });
});

// ─── WhichLLMAdapter — healthCheck ────────────────────────────────────────────

describe('WhichLLMAdapter.healthCheck()', () => {
  it('returns well-shaped health record', async () => {
    const adapter = new WhichLLMAdapter(VALID_CONFIG);
    const health = await adapter.healthCheck();
    assert.equal(health.adapter, ADAPTER_VERSION);
    assert.equal(health.cicSpecVer, CIC_SPEC_VERSION);
    assert.equal(health.amendmentRef, AMENDMENT_REF);
    assert.equal(health.harvesterId, VALID_CONFIG.harvesterId);
    assert.ok(['ok', 'degraded'].includes(health.lineage));
    assert.ok(['ok', 'degraded'].includes(health.governance));
  });
});

// ─── WhichLLMAdapter — query (mocked fetch) ───────────────────────────────────

describe('WhichLLMAdapter.query()', () => {
  it('returns a well-shaped WhichLLMResult on success', async (t) => {
    const mockResponse = { model: 'gpt-4o', response: 'Paris', meta: {} };
    t.mock.method(globalThis, 'fetch', makeFetchMock(mockResponse));

    const adapter = new WhichLLMAdapter(VALID_CONFIG);
    const result = await adapter.query(VALID_QUERY);

    assert.ok(result.resultId, 'resultId present');
    assert.match(result.resultId, /^[0-9a-f]{64}$/);
    assert.equal(result.queryId, VALID_QUERY.queryId);
    assert.equal(result.model, 'gpt-4o');
    assert.equal(result.response, 'Paris');
    assert.match(result.lineageHash, /^[0-9a-f]{64}$/);
    assert.equal(result.cicSpecVer, CIC_SPEC_VERSION);
    assert.equal(result.amendmentRef, AMENDMENT_REF);
    assert.ok(result.latencyMs >= 0);
    assert.ok(result.governance?.attestationId);
    assert.ok(['passed', 'warned', 'failed'].includes(result.governance.status));
  });

  it('throws when prompt is empty', async () => {
    const adapter = new WhichLLMAdapter(VALID_CONFIG);
    await assert.rejects(
      adapter.query({ ...VALID_QUERY, prompt: '   ' }),
      /non-empty string/
    );
  });

  it('throws when queryId is missing', async () => {
    const adapter = new WhichLLMAdapter(VALID_CONFIG);
    const { queryId: _, ...q } = VALID_QUERY;
    await assert.rejects(adapter.query(q), /queryId is required/);
  });

  it('resultId is deterministic for the same query + response', async (t) => {
    const mockResponse = { model: 'gpt-4o', response: 'Paris', meta: {} };
    t.mock.method(globalThis, 'fetch', makeFetchMock(mockResponse));

    const adapter1 = new WhichLLMAdapter(VALID_CONFIG);
    const adapter2 = new WhichLLMAdapter(VALID_CONFIG);

    const r1 = await adapter1.query(VALID_QUERY);
    const r2 = await adapter2.query(VALID_QUERY);

    // Same content → same lineage genesis → same resultId
    assert.equal(r1.resultId, r2.resultId);
  });

  it('emits "result" event on success', async (t) => {
    const mockResponse = { model: 'gpt-4o', response: 'Paris', meta: {} };
    t.mock.method(globalThis, 'fetch', makeFetchMock(mockResponse));

    const adapter = new WhichLLMAdapter(VALID_CONFIG);
    let emitted = null;
    adapter.on('result', (r) => { emitted = r; });

    await adapter.query(VALID_QUERY);
    assert.ok(emitted);
    assert.equal(emitted.queryId, VALID_QUERY.queryId);
  });

  it('emits "error" event and re-throws on HTTP error', async (t) => {
    t.mock.method(globalThis, 'fetch', makeFetchMock({ error: 'bad' }, 500));

    const adapter = new WhichLLMAdapter({ ...VALID_CONFIG, maxRetries: 1 });
    let errorEmitted = false;
    adapter.on('error', () => { errorEmitted = true; });

    await assert.rejects(adapter.query(VALID_QUERY));
    assert.ok(errorEmitted);
  });
});

// ─── WhichLLMAdapter — queryBatch ─────────────────────────────────────────────

describe('WhichLLMAdapter.queryBatch()', () => {
  it('processes items serially and returns ordered results', async (t) => {
    const mockResponse = { model: 'gpt-4o', response: 'ok', meta: {} };
    t.mock.method(globalThis, 'fetch', makeFetchMock(mockResponse));

    const adapter = new WhichLLMAdapter(VALID_CONFIG);
    const queries = [
      { queryId: 'batch-1', prompt: 'Q1' },
      { queryId: 'batch-2', prompt: 'Q2' },
      { queryId: 'batch-3', prompt: 'Q3' },
    ];
    const results = await adapter.queryBatch(queries);
    assert.equal(results.length, 3);
    assert.equal(results[0].queryId, 'batch-1');
    assert.equal(results[1].queryId, 'batch-2');
    assert.equal(results[2].queryId, 'batch-3');
  });
});

// ─── WhichLLMAdapter — lineage ────────────────────────────────────────────────

describe('WhichLLMAdapter lineage chain', () => {
  it('snapshot increases in length with each query', async (t) => {
    const mockResponse = { model: 'gpt-4o', response: 'ok', meta: {} };
    t.mock.method(globalThis, 'fetch', makeFetchMock(mockResponse));

    const adapter = new WhichLLMAdapter(VALID_CONFIG);
    await adapter.query({ queryId: 'lin-1', prompt: 'Hello' });
    await adapter.query({ queryId: 'lin-2', prompt: 'World' });

    const snap = await adapter.getLineageSnapshot();
    assert.equal(snap.length, 2);
    assert.match(snap.headHash, /^[0-9a-f]{64}$/);
  });
});