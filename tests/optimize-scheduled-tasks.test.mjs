import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

test('optimize-scheduled-tasks script exists', () => {
  const scriptPath = resolve('scripts/optimize-scheduled-tasks.ps1');
  assert.equal(existsSync(scriptPath), true);
});
