import assert from 'node:assert/strict';
import test from 'node:test';

import { batchValues } from './marketplace-load.js';

test('batchValues preserves rows and keeps parameter count bounded', () => {
  const values = Array.from({ length: 20_000 }, (_, i) => `($${i * 4 + 1})`);
  const params = Array.from({ length: values.length * 4 }, (_, i) => i);

  const batches = batchValues(values, params, 4);

  assert.equal(batches.length, 2);
  assert.equal(batches[0].values.length, 16_383);
  assert.equal(batches[1].values.length, 3_617);
  assert.deepEqual(batches.flatMap((batch) => batch.values), values);
  assert.deepEqual(batches.flatMap((batch) => batch.params), params);
});
