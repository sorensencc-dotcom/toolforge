import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TorqueQueryEngine, computeEmbedding } from '../engine.js';
import { TorqueQueryClient } from '../client.js';

describe('TorqueQuery Conformance: Determinism & Stability Invariants', () => {
  const corpus = [
    { id: 'memory-1', text: 'Deployment canary approval logs and telemetry metrics' },
    { id: 'memory-2', text: 'Circuit breaker tripping threshold and failure counters' },
    { id: 'memory-3', text: 'Atomic budget gate allocation and token consumption rates' },
    { id: 'memory-4', text: 'Multi-cohort rollout schedule and staging verification' },
    { id: 'memory-5', text: 'Memory drift baseline scoring and counterfactual replay' },
  ];

  it('maintains strict score and rank determinism across repeated server-computed queries', async () => {
    const engine = new TorqueQueryEngine({ corpus });
    const client = new TorqueQueryClient({ engine });
    const query = 'budget gate token allocation';

    const firstRun = await client.search({ query, top_k: 3 });
    const secondRun = await client.search({ query, top_k: 3 });
    const thirdRun = await client.search({ query, top_k: 3 });

    assert.deepEqual(
      firstRun.results.map((r) => r.id),
      secondRun.results.map((r) => r.id)
    );
    assert.deepEqual(
      firstRun.results.map((r) => r.score),
      secondRun.results.map((r) => r.score)
    );
    assert.deepEqual(
      secondRun.results.map((r) => r.id),
      thirdRun.results.map((r) => r.id)
    );
  });

  it('maintains fast-path determinism with caller-supplied embeddings under interleaved queries', async () => {
    const engine = new TorqueQueryEngine({ corpus });
    const client = new TorqueQueryClient({ engine });

    const embeddingA = computeEmbedding('canary deployment logs');
    const embeddingB = computeEmbedding('memory drift scoring');

    // Run A
    const resA1 = await client.search({
      query: 'canary deployment logs',
      normalized_embedding: embeddingA,
      fast_path: true,
      skip_mmr: true,
      top_k: 3,
    });

    // Interleave Run B
    const resB1 = await client.search({
      query: 'memory drift scoring',
      normalized_embedding: embeddingB,
      fast_path: true,
      skip_mmr: true,
      top_k: 3,
    });

    // Repeat Run A
    const resA2 = await client.search({
      query: 'canary deployment logs',
      normalized_embedding: embeddingA,
      fast_path: true,
      skip_mmr: true,
      top_k: 3,
    });

    // Repeat Run B
    const resB2 = await client.search({
      query: 'memory drift scoring',
      normalized_embedding: embeddingB,
      fast_path: true,
      skip_mmr: true,
      top_k: 3,
    });

    assert.deepEqual(
      resA1.results.map((r) => r.id),
      resA2.results.map((r) => r.id)
    );
    assert.deepEqual(
      resA1.results.map((r) => r.score),
      resA2.results.map((r) => r.score)
    );
    assert.deepEqual(
      resB1.results.map((r) => r.id),
      resB2.results.map((r) => r.id)
    );
    assert.deepEqual(
      resB1.results.map((r) => r.score),
      resB2.results.map((r) => r.score)
    );
  });
});
