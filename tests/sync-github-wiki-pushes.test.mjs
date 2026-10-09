import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

test('sync-github-wiki exists and defines push gate', () => {
  const scriptPath = resolve('scripts/sync-github-wiki.mjs');
  assert.equal(existsSync(scriptPath), true);
  const content = readFileSync(scriptPath, 'utf8');
  assert.match(content, /--push/);
});
