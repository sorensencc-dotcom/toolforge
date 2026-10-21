import assert from 'node:assert/strict';
import test from 'node:test';

import { batchValues } from './marketplace-load.js';

test('batchValues preserves rating rows within PostgreSQL parameter limits', () => {
  const values = Array.from({ length: 22_000 }, (_, i) => `($${i * 3 + 1})`);
  const params = Array.from({ length: values.length * 3 }, (_, i) => i);

  const batches = batchValues(values, params, 3);

  assert.equal(batches.length, 2);
  assert.equal(batches[0].values.length, 21_845);
  assert.equal(batches[1].values.length, 155);
  assert.deepEqual(batches.flatMap((batch) => batch.values), values);
  assert.deepEqual(batches.flatMap((batch) => batch.params), params);
});
