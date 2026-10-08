import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

test('graft-deep script exists and defines required parameters', () => {
  const scriptPath = resolve('scripts/graft-deep.ps1');
  assert.equal(existsSync(scriptPath), true);
  const content = readFileSync(scriptPath, 'utf8');
  assert.match(content, /\$Tier/);
  assert.match(content, /\$RepoPath/);
  assert.match(content, /\$DryRun/);
});
