/**
 * Integration Tests — Adapter × Governance × Lineage
 * CIC-WHICHLLM-INTEGRATION-PACK v1.0
 *
 * Runner: Node 20+ built-in test runner  (node --test)
 *
 * Validates the full in-process integration contract:
 *   Adapter → GovernanceWrapper.preCheck()
 *            → WHICHLLM API (mocked)
 *            → GovernanceWrapper.attest()
 *            → LineageContract.stamp()
 *            → WhichLLMResult
 *
 * Tests here do NOT stub internal adapter methods; they mock only the
 * outbound fetch() call, forcing all real codepaths to execute.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { WhichLLMAdapter, deriveId } from '../../src/adapter/whichllm-adapter.js';
import { GENESIS_HASH } from '../../src/lineage/lineage-contract.js';
import { registerHarvester, getHarvester } from '../../src/harvester/harvester-registry.js';

// ─── Shared config ────────────────────────────────────────────────────────────

const HARVESTER_ID = 'cic-whichllm-default-v1'; // pre-seeded in registry

const ADAPTER_CONFIG = {
  apiEndpoint: 'https://api.whichllm.test',
  apiKey: 'integration-test-key',
  harvesterId: HARVESTER_ID,
  tenantId: 'tenant-integration',
  strictMode: true,
};

function mockFetch(model = 'gpt-4o', response = 'Test response') {
  return async (_url, _opts) => ({
    ok: true,
    status: 200,
    json: async () => ({ model, response, meta: {} }),
    text: async () => JSON.stringify({ model, response, meta: {} }),
  });
}

// ─── Integration: single query round-trip ─────────────────────────────────────

describe('Single query round-trip integration', () => {
  it('produces a result with all CIC-required fields populated', async (t) => {
    t.mock.method(globalThis, 'fetch', mockFetch());

    const adapter = new WhichLLMAdapter(ADAPTER_CONFIG);
    const result = await adapter.query({
      queryId: 'int-qry-001',
      prompt: 'Explain the CIC lineage contract in one sentence.',
      modelHints: ['gpt-4o'],
      meta: { environment: 'test', correlationId: 'corr-int-001' },
    });

    // Shape assertions
    assert.match(result.resultId, /^[0-9a-f]{64}$/, 'resultId is SHA-256 hex');
    assert.equal(result.queryId, 'int-qry-001');
    assert.equal(result.model, 'gpt-4o');
    assert.equal(result.response, 'Test response');
    assert.ok(result.latencyMs >= 0, 'latencyMs is non-negative');
    assert.match(result.lineageHash, /^[0-9a-f]{64}$/, 'lineageHash is SHA-256 hex');
    assert.equal(result.cicSpecVer, '2.4.0');
    assert.equal(result.amendmentRef, '§2/S3-A1');

    // Governance attestation shape
    const gov = result.governance;
    assert.ok(gov, 'governance attestation present');
    assert.match(gov.attestationId, /^[0-9a-f]{64}$/);
    assert.equal(gov.harvesterId, HARVESTER_ID);
    assert.equal(gov.specVersion, '2.4.0');
    assert.equal(gov.amendmentRef, '§2/S3-A1');
    assert.equal(gov.status, 'passed');
    assert.ok(Array.isArray(gov.checksRun) && gov.checksRun.length > 0);
    assert.ok(gov.attestedAt);
  });

  it('lineageHash differs from GENESIS_HASH after first query', async (t) => {
    t.mock.method(globalThis, 'fetch', mockFetch());
    const adapter = new WhichLLMAdapter(ADAPTER_CONFIG);
    const result = await adapter.query({ queryId: 'int-qry-002', prompt: 'Hello' });
    assert.notEqual(result.lineageHash, GENESIS_HASH);
  });
});

// ─── Integration: lineage chain across multiple queries ───────────────────────

describe('Lineage chain integrity across sequential queries', () => {
  it('chain grows correctly and verifies after 5 queries', async (t) => {
    t.mock.method(globalThis, 'fetch', mockFetch());
    const adapter = new WhichLLMAdapter(ADAPTER_CONFIG);

    for (let i = 0; i < 5; i++) {
      await adapter.query({ queryId: `chain-qry-${i}`, prompt: `Question ${i}` });
    }

    const snap = await adapter.getLineageSnapshot();
    assert.equal(snap.length, 5);

    // Verify chain continuity: each entry's prevHash matches previous entry's hash
    let expectedPrev = GENESIS_HASH;
    for (const entry of snap.entries) {
      assert.equal(entry.prevHash, expectedPrev, `entry ${entry.index} prevHash mismatch`);
      expectedPrev = entry.hash;
    }
    assert.equal(snap.headHash, expectedPrev);
  });

  it('each query yields a unique lineageHash', async (t) => {
    t.mock.method(globalThis, 'fetch', mockFetch());
    const adapter = new WhichLLMAdapter(ADAPTER_CONFIG);

    const results = await adapter.queryBatch([
      { queryId: 'unique-1', prompt: 'P1' },
      { queryId: 'unique-2', prompt: 'P2' },
      { queryId: 'unique-3', prompt: 'P3' },
    ]);

    const hashes = results.map((r) => r.lineageHash);
    const unique = new Set(hashes);
    assert.equal(unique.size, hashes.length, 'all lineageHashes are distinct');
  });
});

// ─── Integration: governance × registry ──────────────────────────────────────

describe('Governance × registry integration', () => {
  it('fails GC-01 for an unregistered harvesterId', async (t) => {
    t.mock.method(globalThis, 'fetch', mockFetch());
    const adapter = new WhichLLMAdapter({
      ...ADAPTER_CONFIG,
      harvesterId: 'not-in-registry-xyz',
      strictMode: true,
    });
    await assert.rejects(
      adapter.query({ queryId: 'gov-reg-001', prompt: 'Will this pass governance?' }),
      /GC-01/
    );
  });

  it('fails GC-04 for a non-allowlisted model in strictMode', async (t) => {
    t.mock.method(globalThis, 'fetch', mockFetch('rogue-model-v99'));
    const adapter = new WhichLLMAdapter({ ...ADAPTER_CONFIG, strictMode: true });
    await assert.rejects(
      adapter.query({ queryId: 'gov-model-001', prompt: 'Test prompt' }),
      /GC-04/
    );
  });

  it('passes with a dynamically registered harvester', async (t) => {
    t.mock.method(globalThis, 'fetch', mockFetch());
    const dynamicId = `dynamic-harvester-${Date.now()}`;
    registerHarvester({
      harvesterId: dynamicId,
      displayName: 'Dynamic Test Harvester',
      apiEndpoint: 'https://api.whichllm.test',
      status: 'active',
      amendmentRefs: ['§2/S3-A1'],
      capabilities: ['query'],
    });

    const adapter = new WhichLLMAdapter({ ...ADAPTER_CONFIG, harvesterId: dynamicId });
    const result = await adapter.query({ queryId: 'dyn-qry-001', prompt: 'Dynamic test' });
    assert.equal(result.governance.status, 'passed');
  });
});

// ─── Integration: determinism across adapter instances ────────────────────────

describe('Cross-instance determinism', () => {
  it('identical query on two fresh adapters produces the same resultId', async (t) => {
    t.mock.method(globalThis, 'fetch', mockFetch('gpt-4o', 'Same response'));

    const q = { queryId: 'determ-qry-stable', prompt: 'Determinism test' };

    const adapter1 = new WhichLLMAdapter(ADAPTER_CONFIG);
    const r1 = await adapter1.query(q);

    const adapter2 = new WhichLLMAdapter(ADAPTER_CONFIG);
    const r2 = await adapter2.query(q);

    assert.equal(r1.resultId, r2.resultId);
    assert.equal(r1.lineageHash, r2.lineageHash);
  });
});

// ─── Integration: event emissions ────────────────────────────────────────────

describe('Adapter event emissions', () => {
  it('emits "result" after successful query', async (t) => {
    t.mock.method(globalThis, 'fetch', mockFetch());
    const adapter = new WhichLLMAdapter(ADAPTER_CONFIG);
    let resultEvent = null;
    adapter.on('result', (r) => { resultEvent = r; });
    await adapter.query({ queryId: 'evt-001', prompt: 'Event test' });
    assert.ok(resultEvent);
    assert.equal(resultEvent.queryId, 'evt-001');
  });

  it('emits "error" and re-throws on API failure', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => ({
      ok: false, status: 503,
      text: async () => 'Service Unavailable',
    }));
    const adapter = new WhichLLMAdapter({ ...ADAPTER_CONFIG, maxRetries: 1 });
    let errEvent = null;
    adapter.on('error', (e) => { errEvent = e; });
    await assert.rejects(adapter.query({ queryId: 'evt-err-001', prompt: 'Error test' }));
    assert.ok(errEvent, 'error event was emitted');
  });

  it('emits "retry" event on transient failure', async (t) => {
    let callCount = 0;
    t.mock.method(globalThis, 'fetch', async () => {
      callCount++;
      if (callCount === 1) return { ok: false, status: 429, text: async () => 'Rate limited' };
      return { ok: true, status: 200, json: async () => ({ model: 'gpt-4o', response: 'ok', meta: {} }) };
    });
    const adapter = new WhichLLMAdapter({ ...ADAPTER_CONFIG, maxRetries: 3 });
    const retries = [];
    adapter.on('retry', (r) => retries.push(r));
    await adapter.query({ queryId: 'retry-evt-001', prompt: 'Retry test' });
    assert.equal(retries.length, 1);
    assert.equal(retries[0].attempt, 1);
  });
});