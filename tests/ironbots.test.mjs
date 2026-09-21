import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

test('kb-sentinel-bot runs in dry-run mode and writes valid telemetry', () => {
  const scriptPath = path.join(REPO_ROOT, 'scripts', 'kb-sentinel-bot.mjs');
  assert.ok(fs.existsSync(scriptPath), 'kb-sentinel-bot.mjs should exist');

  const stdout = execFileSync('node', [scriptPath, '--dry-run'], {
    cwd: REPO_ROOT,
    encoding: 'utf8'
  });

  assert.match(stdout, /\[KB-Sentinel\] Starting KB-Sync drift and autoheal audit/);
  assert.match(stdout, /Health Score:/);

  const reportPath = path.join(REPO_ROOT, '_status-feed', 'kb_sentinel_report.json');
  assert.ok(fs.existsSync(reportPath), 'kb_sentinel_report.json should exist');

  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  assert.equal(typeof report.healthScore, 'number');
  assert.ok(report.healthScore >= 0 && report.healthScore <= 100);
  assert.equal(report.dryRun, true);
  assert.ok(report.scanned > 0);
});

test('trm-bot-runner runs in dry-run mode and writes valid telemetry', () => {
  const scriptPath = path.join(REPO_ROOT, 'scripts', 'trm-bot-runner.mjs');
  assert.ok(fs.existsSync(scriptPath), 'trm-bot-runner.mjs should exist');

  const stdout = execFileSync('node', [scriptPath, '--dry-run', '--limit=2'], {
    cwd: REPO_ROOT,
    encoding: 'utf8'
  });

  assert.match(stdout, /\[TRM-Bot\] Starting TRM Gap Triage & RFC Drafter/);
  assert.match(stdout, /Registry Status:/);

  const reportPath = path.join(REPO_ROOT, '_status-feed', 'trm_bot_report.json');
  assert.ok(fs.existsSync(reportPath), 'trm_bot_report.json should exist');

  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  assert.equal(typeof report.totalGaps, 'number');
  assert.equal(report.dryRun, true);
});

test('Ironbots scheduled task wrappers exist and contain valid configuration', () => {
  const kbWrapper = path.join(REPO_ROOT, 'scripts', 'schedule-task-wrapper-KB-Sentinel.ps1');
  const trmWrapper = path.join(REPO_ROOT, 'scripts', 'schedule-task-wrapper-TRM-Bot.ps1');

  assert.ok(fs.existsSync(kbWrapper), 'KB Sentinel wrapper should exist');
  assert.ok(fs.existsSync(trmWrapper), 'TRM Bot wrapper should exist');

  const kbContent = fs.readFileSync(kbWrapper, 'utf8');
  assert.match(kbContent, /\\Ironbots\\/);
  assert.match(kbContent, /KB-Sentinel/);

  const trmContent = fs.readFileSync(trmWrapper, 'utf8');
  assert.match(trmContent, /\\Ironbots\\/);
  assert.match(trmContent, /TRM-Bot/);
});
