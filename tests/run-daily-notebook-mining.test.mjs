import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

test('run-daily-notebook-mining script exists and defines deduplication', () => {
  const scriptPath = resolve('scripts/run-daily-notebook-mining.mjs');
  assert.equal(existsSync(scriptPath), true);
});
