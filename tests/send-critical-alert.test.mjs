import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

test('send-critical-alert script exists and has valid parameter contract', () => {
  const scriptPath = resolve('scripts/send-critical-alert.ps1');
  assert.equal(existsSync(scriptPath), true);
  const content = readFileSync(scriptPath, 'utf8');
  assert.match(content, /\$Source/);
  assert.match(content, /\$Severity/);
  assert.match(content, /\$ClearAlert/);
});
