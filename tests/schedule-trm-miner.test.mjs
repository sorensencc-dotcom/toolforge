import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

test('schedule-trm-miner script exists and defines scheduled task configuration', () => {
  const scriptPath = resolve('scripts/schedule-trm-miner.ps1');
  assert.equal(existsSync(scriptPath), true);
  const content = readFileSync(scriptPath, 'utf8');
  assert.match(content, /trm-miner|Register-ScheduledTask/i);
});
