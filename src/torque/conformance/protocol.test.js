import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TorqueQueryEngine, computeEmbedding } from '../engine.js';
import { TorqueQueryClient } from '../client.js';

describe('TorqueQuery Conformance: Protocol & Envelope', () => {
  const sampleCorpus = [
    { id: 'doc-1', text: 'Willow Run B-24 Liberator bomber production history', metadata: { category: 'aviation', topic: 'willow-run' } },
    { id: 'doc-2', text: 'Ford Motor Company mass production tooling and assembly lines', metadata: { category: 'manufacturing', topic: 'ford' } },
    { id: 'doc-3', text: 'Cast Iron Charlie Sorensen production memoirs and logistics', metadata: { category: 'biography', topic: 'charlie' } },
  ];

  it('GET /health returns compliant service metadata and honest backing store', () => {
    const engine = new TorqueQueryEngine({ corpus: sampleCorpus });
    const health = engine.health();

    assert.equal(health.status, 'ok');
    assert.equal(health.service, 'torquequery-memory-drift-search');
    assert.equal(health.backing_store, 'in-memory-conformance');
    assert.equal(typeof health.version, 'string');
    assert.equal(health.corpus_size, 3);
    assert.equal(health.determinism.hash_seed_pinned, true);
    assert.equal(health.determinism.fast_path_deterministic, true);
  });

  it('POST /search returns compliant response envelope for standard query', async () => {
    const engine = new TorqueQueryEngine({ corpus: sampleCorpus });
    const client = new TorqueQueryClient({ engine });

    const response = await client.search({
      query: 'Willow Run bomber production',
      top_k: 2,
    });

    assert.equal(typeof response, 'object');
    assert.equal(response.query, 'Willow Run bomber production');
    assert.equal(typeof response.candidate_pool, 'number');
    assert.equal(response.fast_path_used, false);
    assert.ok(Array.isArray(response.results));
    assert.equal(response.results.length, 2);

    for (const result of response.results) {
      assert.equal(typeof result.id, 'string');
      assert.equal(typeof result.score, 'number');
      assert.ok(result.score >= -1 && result.score <= 1);
      assert.equal(typeof result.metadata, 'object');
    }
  });

  it('evaluates fast-path eligibility strictly (fast_path=true, skip_mmr=true, normalized_embedding provided)', async () => {
    const engine = new TorqueQueryEngine({ corpus: sampleCorpus });
    const client = new TorqueQueryClient({ engine });
    const embedding = computeEmbedding('Willow Run bomber production');

    // Case 1: All 3 criteria met -> fast_path_used is true
    const res1 = await client.search({
      query: 'Willow Run bomber production',
      fast_path: true,
      skip_mmr: true,
      normalized_embedding: embedding,
    });
    assert.equal(res1.fast_path_used, true);

    // Case 2: fast_path true, but skip_mmr false -> fast_path_used is false
    const res2 = await client.search({
      query: 'Willow Run bomber production',
      fast_path: true,
      skip_mmr: false,
      normalized_embedding: embedding,
    });
    assert.equal(res2.fast_path_used, false);

    // Case 3: fast_path true, skip_mmr true, but missing normalized_embedding -> fast_path_used is false
    const res3 = await client.search({
      query: 'Willow Run bomber production',
      fast_path: true,
      skip_mmr: true,
    });
    assert.equal(res3.fast_path_used, false);
  });

  it('includes plan metadata when explain=true', async () => {
    const engine = new TorqueQueryEngine({ corpus: sampleCorpus });
    const client = new TorqueQueryClient({ engine });

    const response = await client.search({
      query: 'Cast Iron Charlie logistics',
      explain: true,
    });

    assert.ok(response.plan);
    assert.equal(typeof response.plan.execution_ms, 'number');
    assert.equal(response.plan.corpus_total, 3);
    assert.equal(response.plan.filtered_count, 3);
    assert.equal(response.plan.embedding_type, 'server_computed');
  });
});
