import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '..');

test('schedule-trm-miner script exists and defines scheduled task configuration', () => {
  const scriptPath = resolve(REPO_ROOT, 'scripts/schedule-trm-miner.ps1');
  assert.equal(existsSync(scriptPath), true);
  const content = readFileSync(scriptPath, 'utf8');
  assert.match(content, /trm-miner|Register-ScheduledTask/i);
});

test('schedule-task-wrapper-TRM-Notebooklm-Mine defines batching and execution limits', () => {
  const scriptPath = resolve(REPO_ROOT, 'trm/schedule-task-wrapper-TRM-Notebooklm-Mine.ps1');
  assert.equal(existsSync(scriptPath), true);
  const content = readFileSync(scriptPath, 'utf8');
  assert.match(content, /\[int\]\$BatchSize\s*=\s*12/);
  assert.match(content, /\[int\]\$MaxExecutionMinutes\s*=\s*90/);
  assert.match(content, /last_mined_at/);
  assert.match(content, /\$HitTimeCeiling/);
});

test('reconcile-scheduled-tasks defines 3 hour execution limit for TRM-Notebooklm-Mine', () => {
  const scriptPath = resolve(REPO_ROOT, 'scripts/reconcile-scheduled-tasks.ps1');
  assert.equal(existsSync(scriptPath), true);
  const content = readFileSync(scriptPath, 'utf8');
  assert.match(content, /TaskName\s*=\s*"TRM-Notebooklm-Mine"[\s\S]*?ExecutionTimeLimitHours\s*=\s*3/);
  assert.match(content, /ExecutionTimeLimitHours/);
});

