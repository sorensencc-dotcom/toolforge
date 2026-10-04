import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

/**
 * Mock implementation of Local Hybrid Reciprocal Rank Fusion (RRF) Search
 * Combines FTS5 BM25 lexical ranks with 384d Dense Vector cosine similarity ranks.
 */
export function mockLocalHybridRRFSearch(query, ftsResults, vectorResults, k = 60) {
  const scores = new Map();
  const docMap = new Map();

  // Process FTS5 BM25 ranks
  ftsResults.forEach((item, index) => {
    const rank = index + 1;
    const current = scores.get(item.id) || 0;
    scores.set(item.id, current + 1 / (k + rank));
    docMap.set(item.id, item);
  });

  // Process Dense Vector ranks
  vectorResults.forEach((item, index) => {
    const rank = index + 1;
    const current = scores.get(item.id) || 0;
    scores.set(item.id, current + 1 / (k + rank));
    if (!docMap.has(item.id)) {
      docMap.set(item.id, item);
    }
  });

  // Sort by fused RRF score
  const fused = Array.from(scores.entries())
    .map(([id, rrfScore]) => ({
      ...docMap.get(id),
      rrfScore
    }))
    .sort((a, b) => b.rrfScore - a.rrfScore);

  return fused;
}

/**
 * Mock implementation of Viking VFS Tiered Resolution Engine
 * Handles L0 (Abstract), L1 (Overview), and L2 (Full Detail) loading rules.
 */
export function mockVikingVFSTierResolver({ path, targetTier, cacheState = {} }) {
  const startTime = performance.now();

  const mockVault = {
    'wiki/concepts/sigil-protocol.md': {
      l0: { slug: 'sigil-protocol-abstract', tokens: 85, content: '# Abstract: Sigil Transactional Protocol\nCryptographic envelope routing for agent swarms.' },
      l1: { slug: 'sigil-protocol-overview', tokens: 1850, content: '# Overview: Sigil Protocol\nInterface contracts, Ed25519 signatures, RFC 8785 JCS canonicalization, and relay architecture.' },
      l2: { slug: 'sigil-protocol-detail', tokens: 7400, content: '# Detail: Sigil Full Spec\n' + 'FULL_SPEC_BODY_DATA_'.repeat(300) }
    }
  };

  const fileEntry = mockVault[path];
  if (!fileEntry) {
    return { error: 'PATH_NOT_FOUND', latencyMs: performance.now() - startTime };
  }

  // Handle Escalation Fallback if L1 is missing or stale
  if (targetTier === 'L1' && (cacheState.isStale || !fileEntry.l1)) {
    const detail = fileEntry.l2;
    return {
      tierLoaded: 'L2_FALLBACK',
      tokens: detail.tokens,
      content: detail.content,
      escalated: true,
      latencyMs: performance.now() - startTime
    };
  }

  const selected = targetTier === 'L0' ? fileEntry.l0 : targetTier === 'L1' ? fileEntry.l1 : fileEntry.l2;
  return {
    tierLoaded: targetTier,
    tokens: selected.tokens,
    content: selected.content,
    escalated: false,
    latencyMs: performance.now() - startTime
  };
}

test('Hybrid RRF Search vs. Viking VFS Latency & Token Benchmark Suite', async (t) => {

  await t.test('TEST-RRF-01: Fuses FTS5 BM25 and Dense Vector ranks with sub-5ms latency', async () => {
    // Generate 100 mock candidate chunks
    const ftsResults = Array.from({ length: 50 }, (_, i) => ({
      id: `doc-chunk-${i + 1}`,
      title: `Chunk ${i + 1}`,
      text: `Content regarding Sigil and kb-sync chunk ${i + 1}`
    }));

    // Dense vector results overlap on doc-chunk-5 and doc-chunk-10 to test score boosting
    const vectorResults = [
      { id: 'doc-chunk-5', title: 'Chunk 5', text: 'Content regarding Sigil and kb-sync chunk 5' },
      { id: 'doc-chunk-10', title: 'Chunk 10', text: 'Content regarding Sigil and kb-sync chunk 10' },
      ...Array.from({ length: 48 }, (_, i) => ({
        id: `doc-chunk-vec-${i + 1}`,
        title: `Vector Chunk ${i + 1}`,
        text: `Dense vector representation chunk ${i + 1}`
      }))
    ];

    const start = performance.now();
    const fused = mockLocalHybridRRFSearch('Sigil protocol envelope', ftsResults, vectorResults);
    const durationMs = performance.now() - start;

    // Latency Assertions
    assert.ok(durationMs < 5.0, `Hybrid RRF search took ${durationMs.toFixed(3)}ms, exceeding 5.0ms threshold`);

    // Top Result Boosting Assertions
    assert.ok(fused.length > 0, 'Fused results must not be empty');
    assert.equal(fused[0].id, 'doc-chunk-5', 'Overlapping BM25 + Vector result must be boosted to top rank');
    assert.ok(fused[0].rrfScore > fused[1].rrfScore, 'Rank 1 score must exceed Rank 2 score');
  });

  await t.test('TEST-VFS-01: Resolves L0/L1 Viking VFS tiers under 2.0ms with >60% token savings', async () => {
    const path = 'wiki/concepts/sigil-protocol.md';

    // Measure L1 Overview Tier Loading
    const l1Result = mockVikingVFSTierResolver({ path, targetTier: 'L1' });
    assert.equal(l1Result.tierLoaded, 'L1');
    assert.ok(l1Result.latencyMs < 2.0, `VFS L1 resolution took ${l1Result.latencyMs.toFixed(3)}ms, exceeding 2.0ms ceiling`);

    // Compare L1 vs L2 Token Savings
    const l2Result = mockVikingVFSTierResolver({ path, targetTier: 'L2' });
    const tokenReduction = (1 - l1Result.tokens / l2Result.tokens) * 100;

    assert.ok(tokenReduction >= 60.0, `Token reduction was ${tokenReduction.toFixed(1)}%, below required 60% savings target`);
    assert.equal(l1Result.tokens, 1850);
    assert.equal(l2Result.tokens, 7400);
  });

  await t.test('TEST-VFS-02: Escalates seamlessly to L2 Detail when L1 overview is stale or missing', async () => {
    const path = 'wiki/concepts/sigil-protocol.md';

    // Simulate stale L1 cache trigger
    const escalatedResult = mockVikingVFSTierResolver({
      path,
      targetTier: 'L1',
      cacheState: { isStale: true }
    });

    assert.equal(escalatedResult.tierLoaded, 'L2_FALLBACK');
    assert.equal(escalatedResult.escalated, true);
    assert.equal(escalatedResult.tokens, 7400);
    assert.ok(escalatedResult.content.includes('FULL_SPEC_BODY_DATA'));
  });

  await t.test('TEST-RRF-VFS-COMBINED: End-to-End Search-to-VFS Tier Selection Pipeline', async () => {
    // Step 1: Execute Hybrid RRF Search
    const fts = [{ id: 'doc-1', path: 'wiki/concepts/sigil-protocol.md', title: 'Sigil Spec' }];
    const vec = [{ id: 'doc-1', path: 'wiki/concepts/sigil-protocol.md', title: 'Sigil Spec' }];
    const fused = mockLocalHybridRRFSearch('sigil protocol JCS', fts, vec);

    assert.equal(fused[0].id, 'doc-1');

    // Step 2: Route top hit to VFS L1 Overview
    const vfsOut = mockVikingVFSTierResolver({ path: fused[0].path, targetTier: 'L1' });

    assert.equal(vfsOut.tierLoaded, 'L1');
    assert.ok(vfsOut.content.includes('RFC 8785 JCS canonicalization'));
    assert.ok(vfsOut.tokens < 2000, 'Context budget respected under 2,000 tokens');
  });

});
