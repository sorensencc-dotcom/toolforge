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

test('ci-watchdog-bot evaluateRunAlerts filters superseded failures and flags active failures', async () => {
  const { evaluateRunAlerts } = await import('../scripts/ci-watchdog-bot.mjs');

  const mockRuns = [
    // 1. In-progress run
    { databaseId: 101, name: 'Delivery Guard', headBranch: 'feature/x', status: 'in_progress', conclusion: null },
    // 2. Latest run on parkd821-20260908 is success
    { databaseId: 102, name: 'Governance', headBranch: 'parkd821-20260908', status: 'completed', conclusion: 'success', headSha: '2a6478061234', url: 'https://github.com/.../102' },
    // 3. Historical superseded run on same branch is failure (should be ignored)
    { databaseId: 103, name: 'Governance', headBranch: 'parkd821-20260908', status: 'completed', conclusion: 'failure', headSha: 'e354e2af1234', url: 'https://github.com/.../103' },
    // 4. Latest run on another-branch is failure (should be alerted)
    { databaseId: 104, name: 'Lint', headBranch: 'bugfix/y', status: 'completed', conclusion: 'failure', headSha: 'deadbeef1234', url: 'https://github.com/.../104' }
  ];

  const mockLogFn = (runId) => [`Error in run ${runId}`];
  const result = evaluateRunAlerts(mockRuns, mockLogFn);

  assert.equal(result.activeRuns.length, 1);
  assert.equal(result.activeRuns[0].databaseId, 101);
  assert.equal(result.completedRuns.length, 3);
  assert.equal(result.failureCount, 1, 'Only active latest failures should be counted, superseded ignored');
  assert.equal(result.status, 'FAILURES_DETECTED');
  assert.equal(result.alerts.length, 1);
  assert.equal(result.alerts[0].runId, 104);
  assert.equal(result.alerts[0].branch, 'bugfix/y');
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

test('ironbots-daily-reporter runs and generates aggregated daily telemetry with host heartbeat', async () => {
  const { aggregateFleetActivity, getHostHeartbeat } = await import('../scripts/ironbots-daily-reporter.mjs');
  
  const heartbeat = getHostHeartbeat();
  assert.equal(typeof heartbeat.hostname, 'string');
  assert.ok(heartbeat.uptimeSeconds >= 0);
  assert.equal(typeof heartbeat.taskScheduler, 'object');
  assert.ok(typeof heartbeat.taskScheduler.status === 'string');

  const report = await aggregateFleetActivity({ isDryRun: true });
  assert.equal(typeof report.fleetHealthScore, 'number');
  assert.ok(report.fleetHealthScore >= 0 && report.fleetHealthScore <= 100);
  assert.equal(report.botCount, 7);
  assert.ok(Array.isArray(report.activeBots));
  assert.equal(report.activeBots.length, 7);
  assert.ok(report.hostHeartbeat);
  assert.equal(typeof report.hostHeartbeat.hostname, 'string');
});

test('daemon-healer exports thrash guard configuration with cooldown window', async () => {
  const { THRASH_GUARD_CONFIG } = await import('../scripts/daemon-healer-bot.mjs');
  assert.ok(THRASH_GUARD_CONFIG);
  assert.equal(THRASH_GUARD_CONFIG.maxConsecutiveHeals, 3);
  assert.equal(THRASH_GUARD_CONFIG.cooldownStatus, 'ALERT_ONLY_COOLDOWN');
  assert.equal(typeof THRASH_GUARD_CONFIG.cooldownWindowMs, 'number');
  assert.ok(THRASH_GUARD_CONFIG.cooldownWindowMs >= 3600000);
});

test('ironbots-daily-reporter exports REQUIRED_FLEET_TASKS with 8 tasks', async () => {
  const { REQUIRED_FLEET_TASKS } = await import('../scripts/ironbots-daily-reporter.mjs');
  assert.ok(Array.isArray(REQUIRED_FLEET_TASKS));
  assert.equal(REQUIRED_FLEET_TASKS.length, 8);
  assert.ok(REQUIRED_FLEET_TASKS.includes('TRM-Drive-Sync'));
  assert.ok(REQUIRED_FLEET_TASKS.includes('Daemon-Healer'));
  assert.ok(REQUIRED_FLEET_TASKS.includes('Ironbots-Reporter'));
});

test('trm-ingress-watcher exports safeMoveFile and parsePayload helpers', async () => {
  const { safeMoveFile, parsePayload } = await import('../scripts/trm-ingress-watcher.mjs');
  assert.equal(typeof safeMoveFile, 'function');
  assert.equal(typeof parsePayload, 'function');

  const validJson = JSON.stringify({
    source: 'mobile-gemini',
    action_type: 'antigravity_triage',
    intent: 'test_intent'
  });
  const parsed = parsePayload(validJson, '.json');
  assert.equal(parsed.source, 'mobile-gemini');
  assert.equal(parsed.action_type, 'antigravity_triage');

  // safeMoveFile returns false cleanly on non-existent file
  const nonExistent = path.join(REPO_ROOT, 'logs', `non-existent-${Date.now()}.tmp`);
  const dest = path.join(REPO_ROOT, 'logs', `dest-${Date.now()}.tmp`);
  assert.equal(safeMoveFile(nonExistent, dest), false);
});

test('Ironbots scheduled task wrappers exist and contain valid configuration', () => {
  const wrappers = [
    { file: 'scripts/schedule-task-wrapper-Notebook-Ingester.ps1', name: 'Notebook-Ingester' },
    { file: 'scripts/schedule-task-wrapper-KB-Sentinel.ps1', name: 'KB-Sentinel' },
    { file: 'scripts/schedule-task-wrapper-TRM-Bot.ps1', name: 'TRM-Bot' },
    { file: 'scripts/schedule-task-wrapper-Watchlist-Miner.ps1', name: 'Watchlist-Miner' },
    { file: 'scripts/schedule-task-wrapper-Daemon-Healer.ps1', name: 'Daemon-Healer' },
    { file: 'scripts/schedule-task-wrapper-CI-Watchdog.ps1', name: 'CI-Watchdog' },
    { file: 'scripts/schedule-task-wrapper-TRM-Ingress-Watcher.ps1', name: 'TRM-Drive-Sync' },
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

test('git-push-and-wait script exists and contains Devin blocking gate parameters', () => {
  const gateScript = path.join(REPO_ROOT, 'scripts', 'git-push-and-wait.ps1');
  assert.ok(fs.existsSync(gateScript), 'git-push-and-wait.ps1 should exist');

  const content = fs.readFileSync(gateScript, 'utf8');
  assert.match(content, /param\(/);
  assert.match(content, /\[string\]\$Branch/);
  assert.match(content, /\[int\]\$TimeoutSeconds/);
  assert.match(content, /\[switch\]\$SkipWait/);
  assert.match(content, /\[int\]\$PRNumber/);
  assert.match(content, /gh pr view/);
  assert.match(content, /statusCheckRollup/);
  assert.match(content, /devin-ai-integration/);
});

