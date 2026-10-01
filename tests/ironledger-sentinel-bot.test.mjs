import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

test('ironledger-sentinel-bot runs in dry-run mode and writes valid telemetry', () => {
  const scriptPath = path.join(REPO_ROOT, 'scripts', 'ironledger-sentinel-bot.mjs');
  assert.ok(fs.existsSync(scriptPath), 'ironledger-sentinel-bot.mjs should exist');

  const stdout = execFileSync('node', [scriptPath, '--dry-run'], {
    cwd: REPO_ROOT,
    encoding: 'utf8'
  });

  assert.match(stdout, /\[IronLedger-Sentinel\] Starting IronLedger health supervision/);
  assert.match(stdout, /Workbench UI/);
  assert.match(stdout, /Database:/);

  const reportPath = path.join(REPO_ROOT, '_status-feed', 'ironledger_health.json');
  assert.ok(fs.existsSync(reportPath), 'ironledger_health.json should exist');

  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  assert.ok(typeof report.status === 'string');
  assert.equal(report.dryRun, true);
  assert.ok(report.workbench);
  assert.ok(report.database);
  assert.ok(report.invariants);
  assert.ok(report.scheduledSyncs);
  assert.equal(typeof report.scheduledSyncs.taskCount, 'number');
});

test('schedule-task-wrapper-IronLedger-Sentinel.ps1 exists and contains required S4U and Ironbots metadata', () => {
  const wrapperPath = path.join(REPO_ROOT, 'scripts', 'schedule-task-wrapper-IronLedger-Sentinel.ps1');
  assert.ok(fs.existsSync(wrapperPath), 'schedule-task-wrapper-IronLedger-Sentinel.ps1 should exist');

  const content = fs.readFileSync(wrapperPath, 'utf8');
  assert.match(content, /\\Ironbots\\/);
  assert.match(content, /IronLedger-Sentinel/);
  assert.match(content, /S4U/);
  assert.match(content, /ironledger-sentinel-bot\.mjs/);
});

test('ironledger-sentinel-bot probeUrl handles custom responses and timeouts gracefully', async () => {
  const { probeUrl } = await import('../scripts/ironledger-sentinel-bot.mjs');

  // Probe a non-listening port to ensure graceful error handling
  const result = await probeUrl('http://127.0.0.1:59999/healthz', { timeoutMs: 300 });
  assert.equal(result.ok, false);
  assert.ok(result.error);
});
