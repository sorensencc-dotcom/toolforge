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

test('daemon-healer-bot runs in check-only mode and writes valid telemetry', () => {
  const scriptPath = path.join(REPO_ROOT, 'scripts', 'daemon-healer-bot.mjs');
  assert.ok(fs.existsSync(scriptPath), 'daemon-healer-bot.mjs should exist');

  const stdout = execFileSync('node', [scriptPath, '--dry-run', '--check-only'], {
    cwd: REPO_ROOT,
    encoding: 'utf8'
  });

  assert.match(stdout, /\[Daemon-Healer\] Checking dashboard daemon health/);

  const reportPath = path.join(REPO_ROOT, '_status-feed', 'daemon_health.json');
  assert.ok(fs.existsSync(reportPath), 'daemon_health.json should exist');

  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  assert.ok(typeof report.status === 'string');
  assert.equal(report.dryRun, true);
});

test('ci-watchdog-bot runs in dry-run mode and writes valid telemetry', () => {
  const scriptPath = path.join(REPO_ROOT, 'scripts', 'ci-watchdog-bot.mjs');
  assert.ok(fs.existsSync(scriptPath), 'ci-watchdog-bot.mjs should exist');

  const stdout = execFileSync('node', [scriptPath, '--dry-run'], {
    cwd: REPO_ROOT,
    encoding: 'utf8'
  });

  assert.match(stdout, /\[CI-Watchdog\] Checking remote CI and GitHub Actions status/);

  const reportPath = path.join(REPO_ROOT, '_status-feed', 'ci_alerts.json');
  assert.ok(fs.existsSync(reportPath), 'ci_alerts.json should exist');

  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  assert.ok(typeof report.status === 'string');
  assert.equal(report.dryRun, true);
});

test('notebook-ingester-bot runs in dry-run mode and writes valid telemetry', () => {
  const scriptPath = path.join(REPO_ROOT, 'scripts', 'notebook-ingester-bot.mjs');
  assert.ok(fs.existsSync(scriptPath), 'notebook-ingester-bot.mjs should exist');

  const stdout = execFileSync('node', [scriptPath, '--dry-run'], {
    cwd: REPO_ROOT,
    encoding: 'utf8'
  });

  assert.match(stdout, /\[Notebook-Ingester\] Starting Knowledge Ingester Bot/);
  assert.match(stdout, /Completed indexing in/);

  const reportPath = path.join(REPO_ROOT, '_status-feed', 'notebook_ingester_report.json');
  assert.ok(fs.existsSync(reportPath), 'notebook_ingester_report.json should exist');

  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  assert.equal(typeof report.totalFiles, 'number');
  assert.ok(report.totalFiles > 0);
  assert.equal(report.dryRun, true);
  assert.equal(report.status, 'HEALTHY');
});

test('watchlist-miner-bot runs in dry-run mode and writes valid telemetry', () => {
  const scriptPath = path.join(REPO_ROOT, 'scripts', 'watchlist-miner-bot.mjs');
  assert.ok(fs.existsSync(scriptPath), 'watchlist-miner-bot.mjs should exist');

  const stdout = execFileSync('node', [scriptPath, '--dry-run', '--limit=2'], {
    cwd: REPO_ROOT,
    encoding: 'utf8'
  });

  assert.match(stdout, /\[Watchlist-Miner\] Starting Competitor Drift Miner Bot/);
  assert.match(stdout, /Execution complete in/);

  const reportPath = path.join(REPO_ROOT, '_status-feed', 'watchlist_miner_report.json');
  assert.ok(fs.existsSync(reportPath), 'watchlist_miner_report.json should exist');

  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  assert.equal(typeof report.totalWatchlists, 'number');
  assert.ok(report.totalWatchlists > 0);
  assert.equal(report.dryRun, true);
  assert.ok(['PASS', 'DRIFT_DETECTED'].includes(report.status));
});

test('ironbots-daily-reporter runs and generates aggregated daily telemetry', () => {
  const scriptPath = path.join(REPO_ROOT, 'scripts', 'ironbots-daily-reporter.mjs');
  assert.ok(fs.existsSync(scriptPath), 'ironbots-daily-reporter.mjs should exist');

  const stdout = execFileSync('node', [scriptPath, '--dry-run'], {
    cwd: REPO_ROOT,
    encoding: 'utf8'
  });

  assert.match(stdout, /\[Ironbots-Reporter\] Compiling daily fleet telemetry report/);
  assert.match(stdout, /Fleet Report Compiled in/);

  const reportPath = path.join(REPO_ROOT, '_status-feed', 'ironbots_daily_report.json');
  if (fs.existsSync(reportPath)) {
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    assert.equal(typeof report.fleetHealthScore, 'number');
    assert.ok(report.fleetHealthScore >= 0 && report.fleetHealthScore <= 100);
    assert.equal(typeof report.botCount, 'number');
    assert.ok(report.botCount >= 6);
    assert.ok(Array.isArray(report.activeBots));
    assert.ok(report.activeBots.length >= 6);
  }
});

test('Ironbots scheduled task wrappers exist and contain valid configuration', () => {
  const wrappers = [
    { file: 'scripts/schedule-task-wrapper-Notebook-Ingester.ps1', name: 'Notebook-Ingester' },
    { file: 'scripts/schedule-task-wrapper-KB-Sentinel.ps1', name: 'KB-Sentinel' },
    { file: 'scripts/schedule-task-wrapper-TRM-Bot.ps1', name: 'TRM-Bot' },
    { file: 'scripts/schedule-task-wrapper-Watchlist-Miner.ps1', name: 'Watchlist-Miner' },
    { file: 'scripts/schedule-task-wrapper-Daemon-Healer.ps1', name: 'Daemon-Healer' },
    { file: 'scripts/schedule-task-wrapper-CI-Watchdog.ps1', name: 'CI-Watchdog' },
    { file: 'scripts/schedule-task-wrapper-Ironbots-Reporter.ps1', name: 'Ironbots-Reporter' }
  ];

  for (const w of wrappers) {
    const fullPath = path.join(REPO_ROOT, w.file);
    assert.ok(fs.existsSync(fullPath), `${w.file} should exist`);
    const content = fs.readFileSync(fullPath, 'utf8');
    assert.match(content, /\\Ironbots\\/, `${w.file} should use \\Ironbots\\ path`);
    assert.match(content, new RegExp(w.name), `${w.file} should define ${w.name}`);
    assert.match(content, /S4U/, `${w.file} should support S4U unattended execution`);
  }
});

test('reconcile-scheduled-tasks script exists and defines all fleet categories', () => {
  const scriptPath = path.join(REPO_ROOT, 'scripts', 'reconcile-scheduled-tasks.ps1');
  assert.ok(fs.existsSync(scriptPath), 'reconcile-scheduled-tasks.ps1 should exist');

  const content = fs.readFileSync(scriptPath, 'utf8');
  assert.match(content, /\\Ironbots\\/);
  assert.match(content, /\\toolforge\\/);
  assert.match(content, /\\CIC\\/);
  assert.match(content, /\\TRM\\/);
  assert.match(content, /\\KB-SYNC\\/);
  assert.match(content, /LogonType S4U/);
});

test('weekly retro and reporting schedule scripts exist and target toolforge category', () => {
  const weeklyScript = path.join(REPO_ROOT, 'scripts', 'setup-weekly-report-schedule.ps1');
  const runRetroScript = path.join(REPO_ROOT, 'scripts', 'run-weekly-retro.ps1');

  assert.ok(fs.existsSync(weeklyScript), 'setup-weekly-report-schedule.ps1 should exist');
  assert.ok(fs.existsSync(runRetroScript), 'run-weekly-retro.ps1 should exist');

  const content = fs.readFileSync(weeklyScript, 'utf8');
  assert.match(content, /\\toolforge\\/);
  assert.match(content, /toolforge-weekly-report-agent/);
});

