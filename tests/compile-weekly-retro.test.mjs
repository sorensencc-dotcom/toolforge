import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

test('compile-weekly-retro script exists and declares CLI flags', () => {
  const scriptPath = resolve('scripts/compile-weekly-retro.mjs');
  assert.equal(existsSync(scriptPath), true);
  const content = readFileSync(scriptPath, 'utf8');
  assert.match(content, /--dry-run/);
  assert.match(content, /--date/);
});
