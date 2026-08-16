import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TorqueQueryEngine } from '../engine.js';
import { TorqueQueryClient } from '../client.js';

describe('TorqueQuery Conformance: Metadata & Tag Filtering', () => {
  const corpus = [
    { id: 'doc-1', text: 'Willow Run assembly operations', metadata: { domain: 'automotive', tier: 1, path: 'vault/charlie/willow.md' } },
    { id: 'doc-2', text: 'Cast iron metallurgy handbook', metadata: { domain: 'metallurgy', tier: 2, path: 'vault/charlie/foundry.md' } },
    { id: 'doc-3', text: 'Model T logistics report', metadata: { domain: 'automotive', tier: 1, path: 'vault/ford/modelt.md' } },
    { id: 'doc-4', text: 'Highland Park dynamo installation', metadata: { domain: 'power', tier: 3, path: 'archive/ford/power.md' } },
  ];

  it('filters by exact field match', async () => {
    const engine = new TorqueQueryEngine({ corpus });
    const client = new TorqueQueryClient({ engine });

    const response = await client.search({
      query: 'operations',
      filters: { domain: 'automotive' },
    });

    assert.equal(response.results.length, 2);
    for (const res of response.results) {
      assert.equal(res.metadata.domain, 'automotive');
    }
  });

  it('filters by $in array membership clause', async () => {
    const engine = new TorqueQueryEngine({ corpus });
    const client = new TorqueQueryClient({ engine });

    const response = await client.search({
      query: 'technology',
      filters: { domain: { $in: ['metallurgy', 'power'] } },
    });

    assert.equal(response.results.length, 2);
    const ids = response.results.map((r) => r.id);
    assert.ok(ids.includes('doc-2'));
    assert.ok(ids.includes('doc-4'));
  });

  it('filters by $prefix string matching clause', async () => {
    const engine = new TorqueQueryEngine({ corpus });
    const client = new TorqueQueryClient({ engine });

    const response = await client.search({
      query: 'handbook and notes',
      filters: { path: { $prefix: 'vault/charlie/' } },
    });

    assert.equal(response.results.length, 2);
    const ids = response.results.map((r) => r.id);
    assert.ok(ids.includes('doc-1'));
    assert.ok(ids.includes('doc-2'));
  });

  it('returns empty results cleanly when no documents match filters', async () => {
    const engine = new TorqueQueryEngine({ corpus });
    const client = new TorqueQueryClient({ engine });

    const response = await client.search({
      query: 'anything',
      filters: { domain: 'aerospace-nonexistent' },
    });

    assert.equal(response.results.length, 0);
    assert.equal(response.candidate_pool, 0);
  });
});
