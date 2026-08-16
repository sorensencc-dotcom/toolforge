import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TorqueQueryEngine } from '../engine.js';
import { TorqueQueryClient } from '../client.js';
import { TORQUE_ERROR_CODES, TorqueQueryError } from '../types.js';

describe('TorqueQuery Conformance: Error Taxonomy & Boundaries', () => {
  const corpus = [
    { id: 'item-1', text: 'Sample test document one' },
  ];

  it('rejects empty and whitespace-only queries with EMPTY_QUERY', async () => {
    const engine = new TorqueQueryEngine({ corpus });
    const client = new TorqueQueryClient({ engine });

    await assert.rejects(
      async () => client.search({ query: '' }),
      (err) => err instanceof TorqueQueryError && err.code === TORQUE_ERROR_CODES.EMPTY_QUERY
    );

    await assert.rejects(
      async () => client.search({ query: '    ' }),
      (err) => err instanceof TorqueQueryError && err.code === TORQUE_ERROR_CODES.EMPTY_QUERY
    );
  });

  it('rejects non-integer, negative, or oversized limits with BAD_LIMIT', async () => {
    const engine = new TorqueQueryEngine({ corpus });
    const client = new TorqueQueryClient({ engine });

    // Zero
    await assert.rejects(
      async () => client.search({ query: 'valid query', top_k: 0 }),
      (err) => err instanceof TorqueQueryError && err.code === TORQUE_ERROR_CODES.BAD_LIMIT
    );

    // Negative
    await assert.rejects(
      async () => client.search({ query: 'valid query', top_k: -5 }),
      (err) => err instanceof TorqueQueryError && err.code === TORQUE_ERROR_CODES.BAD_LIMIT
    );

    // Non-integer
    await assert.rejects(
      async () => client.search({ query: 'valid query', top_k: 2.5 }),
      (err) => err instanceof TorqueQueryError && err.code === TORQUE_ERROR_CODES.BAD_LIMIT
    );

    // Exceeds max top_k (1000)
    await assert.rejects(
      async () => client.search({ query: 'valid query', top_k: 5000 }),
      (err) => err instanceof TorqueQueryError && err.code === TORQUE_ERROR_CODES.BAD_LIMIT
    );
  });

  it('rejects malformed requests with BAD_REQUEST', async () => {
    const engine = new TorqueQueryEngine({ corpus });
    const client = new TorqueQueryClient({ engine });

    await assert.rejects(
      async () => client.search(null),
      (err) => err instanceof TorqueQueryError && err.code === TORQUE_ERROR_CODES.BAD_REQUEST
    );

    await assert.rejects(
      async () => client.search({}),
      (err) => err instanceof TorqueQueryError && (err.code === TORQUE_ERROR_CODES.BAD_REQUEST || err.code === TORQUE_ERROR_CODES.EMPTY_QUERY)
    );
  });
});
