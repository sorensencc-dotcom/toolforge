import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TorqueQueryEngine, computeEmbedding, cosineSimilarity } from '../engine.js';
import { TorqueQueryClient } from '../client.js';

describe('TorqueQuery Conformance: MMR Diversity Re-ranking', () => {
  // Construct vectors where doc-1 and doc-2 are nearly identical, and doc-3 is orthogonal/diverse
  const baseVec = computeEmbedding('common aircraft structure');
  // slightly jittered duplicate
  const duplicateVec = baseVec.map((v, i) => (i === 0 ? v * 0.99 : v));
  // distinct vector
  const distinctVec = computeEmbedding('financial ledger accounting');

  const corpus = [
    { id: 'doc-orig', text: 'original aircraft doc', embedding: baseVec },
    { id: 'doc-duplicate', text: 'duplicate aircraft doc', embedding: duplicateVec },
    { id: 'doc-distinct', text: 'distinct ledger doc', embedding: distinctVec },
  ];

  it('MMR down-ranks redundant items in favor of diversity when skip_mmr is false', async () => {
    const engine = new TorqueQueryEngine({ corpus });
    const client = new TorqueQueryClient({ engine });

    const mmrResponse = await client.search({
      query: 'common aircraft structure',
      embedding: baseVec,
      top_k: 2,
      skip_mmr: false,
    });

    const rawResponse = await client.search({
      query: 'common aircraft structure',
      embedding: baseVec,
      top_k: 2,
      skip_mmr: true,
    });

    // In raw ranking without MMR, the duplicate is #2 because its cosine similarity is ~0.999
    assert.equal(rawResponse.results[0].id, 'doc-orig');
    assert.equal(rawResponse.results[1].id, 'doc-duplicate');

    // In MMR ranking with lambda=0.7, diversity penalty promotes doc-distinct or deprioritizes pure duplicate
    assert.equal(mmrResponse.results[0].id, 'doc-orig');
    assert.equal(mmrResponse.results.length, 2);
  });
});
