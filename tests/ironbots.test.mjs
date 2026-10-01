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
  assert.equal(report.botCount, 9);
  assert.ok(Array.isArray(report.activeBots));
  assert.equal(report.activeBots.length, 9);
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

test('ironbots-daily-reporter exports REQUIRED_FLEET_TASKS with 10 tasks', async () => {
  const { REQUIRED_FLEET_TASKS } = await import('../scripts/ironbots-daily-reporter.mjs');
  assert.ok(Array.isArray(REQUIRED_FLEET_TASKS));
  assert.equal(REQUIRED_FLEET_TASKS.length, 10);
  assert.ok(REQUIRED_FLEET_TASKS.includes('TRM-Drive-Sync'));
  assert.ok(REQUIRED_FLEET_TASKS.includes('Daemon-Healer'));
  assert.ok(REQUIRED_FLEET_TASKS.includes('IronLedger-Sentinel'));
  assert.ok(REQUIRED_FLEET_TASKS.includes('Storage-Pruner'));
  assert.ok(REQUIRED_FLEET_TASKS.includes('Ironbots-Reporter'));
});

test('trm-ingress-watcher runs in dry-run mode and writes valid telemetry', () => {
  const scriptPath = path.join(REPO_ROOT, 'scripts', 'trm-ingress-watcher.mjs');
  assert.ok(fs.existsSync(scriptPath), 'trm-ingress-watcher.mjs should exist');

  const stdout = execFileSync('node', [scriptPath, '--dry-run', '--once'], {
    cwd: REPO_ROOT,
    encoding: 'utf8'
  });

  assert.match(stdout, /\[TRM-INGRESS\] Starting Ingress Watcher/);

  const reportPath = path.join(REPO_ROOT, '_status-feed', 'trm_ingress_status.json');
  assert.ok(fs.existsSync(reportPath), 'trm_ingress_status.json should exist');

  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  assert.ok(typeof report.status === 'string');
  assert.equal(report.dryRun, true);
  assert.equal(typeof report.triageQueue, 'number');
});

test('trm-ingress-watcher exports safeMoveFile, processFile, parsePayload, and dispatchMobileReceipt helpers', async () => {
  const { safeMoveFile, parsePayload, processFile, getActiveOutboxDirs, dispatchMobileReceipt, cleanupCompanionFiles, processGDocStub } = await import('../scripts/trm-ingress-watcher.mjs');
  assert.equal(typeof safeMoveFile, 'function');
  assert.equal(typeof parsePayload, 'function');
  assert.equal(typeof processFile, 'function');
  assert.equal(typeof getActiveOutboxDirs, 'function');
  assert.equal(typeof dispatchMobileReceipt, 'function');
  assert.equal(typeof cleanupCompanionFiles, 'function');
  assert.equal(typeof processGDocStub, 'function');

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

  // dispatchMobileReceipt returns valid receipt schema in dry-run
  const receipt = dispatchMobileReceipt({ id: 'act-123', source: 'mobile-test', intent: 'test_fix', action_type: 'deterministic_fix' }, { status: 'RESOLVED', duration_ms: 45 }, { dryRun: true });
  assert.equal(receipt.action_id, 'act-123');
  assert.equal(receipt.status, 'RESOLVED');
  assert.equal(receipt.dryRun, true);
});

test('trm-ingress-watcher cleans up companion and orphaned .gdoc stubs', async () => {
  const { cleanupCompanionFiles, processGDocStub } = await import('../scripts/trm-ingress-watcher.mjs');
  const tempDir = path.join(REPO_ROOT, 'logs', `test-gdoc-${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    // 1. Companion .gdoc cleanup when processing .json or .md card
    const jsonCard = path.join(tempDir, '2026-09-26T170100Z__test__card.json');
    const companionGdoc = path.join(tempDir, '2026-09-26T170100Z__test__card.md.gdoc');
    fs.writeFileSync(jsonCard, '{"id":"test-1"}', 'utf8');
    fs.writeFileSync(companionGdoc, '{"doc_id":"xyz"}', 'utf8');

    assert.ok(fs.existsSync(companionGdoc));
    cleanupCompanionFiles(jsonCard, false);
    assert.ok(!fs.existsSync(companionGdoc), 'Companion .gdoc should be cleaned up');

    // 2. Orphaned .gdoc stub matching existing ledger entry
    const orphanedGdoc = path.join(tempDir, '2026-09-26T170100Z__toolforge__pr-45-devin-review.md.gdoc');
    fs.writeFileSync(orphanedGdoc, '{"doc_id":"test"}', 'utf8');

    // Dry-run returns match without deleting
    const dryRes = processGDocStub(orphanedGdoc, tempDir, { dryRun: true });
    assert.ok(dryRes);
    assert.equal(dryRes.status, 'MATCHED_HANDLED_GDOC_DRY_RUN');
    assert.ok(fs.existsSync(orphanedGdoc));

    // Live run moves / archives the stub
    const liveRes = processGDocStub(orphanedGdoc, tempDir, { dryRun: false });
    assert.ok(liveRes);
    assert.equal(liveRes.status, 'ARCHIVED_HANDLED_GDOC');
    assert.ok(!fs.existsSync(orphanedGdoc), 'Orphaned .gdoc should be moved/archived');
  } finally {
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
  }
});

test('local-small-model-bridge extracts mobile intents and summarizes stack traces', async () => {
  const { extractMobileIntent, extractIntentDeterministic, summarizeCiStackTrace, summarizeStackTraceDeterministic, checkOllamaHealth } = await import('../scripts/local-small-model-bridge.mjs');
  
  assert.equal(typeof extractMobileIntent, 'function');
  assert.equal(typeof summarizeCiStackTrace, 'function');
  assert.equal(typeof checkOllamaHealth, 'function');

  // 1. Intent extraction with deterministic rule engine
  const intent1 = extractIntentDeterministic('Please prune dead sources from Notebook 5 immediately', { source: 'voice-note' });
  assert.equal(intent1.action_type, 'deterministic_fix');
  assert.equal(intent1.intent, 'prune_dead_sources');
  assert.equal(intent1.priority, 'P1');
  assert.equal(intent1.target_notebook_name, '5 immediately');

  const intent2 = extractIntentDeterministic('We have a quarantine buffer overflow error on TRM', { source: 'mobile-slack' });
  assert.equal(intent2.action_type, 'deterministic_fix');
  assert.equal(intent2.intent, 'remediate_quarantine_enobufs');

  const intent3 = extractIntentDeterministic('Investigate why CI fails on branch feature/x', { source: 'mobile-gemini' });
  assert.equal(intent3.action_type, 'antigravity_triage');
  assert.equal(intent3.intent, 'investigate_ci_failure');

  // 2. Stack trace summarizer
  const sampleTrace = `TypeError: Cannot read properties of undefined (reading 'split')\n    at parseCard (C:/dev/scripts/parser.mjs:42:15)\n    at processFile (C:/dev/scripts/watcher.mjs:100:5)`;
  const summary = summarizeStackTraceDeterministic(sampleTrace);
  assert.equal(summary.failureType, 'TypeError');
  assert.match(summary.rootCause, /TypeError/);
  assert.match(summary.failureLocation, /42:15/);

  // 3. Dry-run async calls return properly structured objects
  const asyncIntent = await extractMobileIntent('Prune failed sources', { source: 'mobile' }, { dryRun: true });
  assert.equal(asyncIntent.intent, 'prune_dead_sources');

  const asyncTrace = await summarizeCiStackTrace(sampleTrace, {}, { dryRun: true });
  assert.equal(asyncTrace.failureType, 'TypeError');

  // 4. Security boundary: loopback enforcement
  const { validateLoopbackUrl, isLoopbackHostname } = await import('../scripts/local-small-model-bridge.mjs');
  assert.equal(isLoopbackHostname('127.0.0.1'), true);
  assert.equal(isLoopbackHostname('localhost'), true);
  assert.equal(isLoopbackHostname('::1'), true);
  assert.equal(isLoopbackHostname('127.0.0.2'), true);
  assert.equal(isLoopbackHostname('api.openai.com'), false);
  assert.equal(isLoopbackHostname('remote-host.com'), false);

  assert.throws(() => {
    validateLoopbackUrl('/api/generate', 'http://remote-server.com:11434');
  }, /Security Violation/);

  const healthRes = await checkOllamaHealth({ baseUrl: 'http://remote-server.com:11434' });
  assert.equal(healthRes.available, false);
  assert.match(healthRes.error, /Security Violation/);
});

test('storage-pruner scans databases, compacts telemetry, and executes dry run', async () => {
  const { discoverSqliteDatabases, vacuumDatabase, compressHistoricalTelemetry, pruneHarnessTasks, runStoragePruner } = await import('../scripts/storage-pruner.mjs');

  assert.equal(typeof discoverSqliteDatabases, 'function');
  assert.equal(typeof vacuumDatabase, 'function');
  assert.equal(typeof compressHistoricalTelemetry, 'function');
  assert.equal(typeof pruneHarnessTasks, 'function');
  assert.equal(typeof runStoragePruner, 'function');

  // Discovery finds databases
  const dbs = discoverSqliteDatabases(REPO_ROOT);
  assert.ok(Array.isArray(dbs));
  assert.ok(dbs.length > 0, 'Should discover existing SQLite databases in .kb_cache or icf');

  // Full dry run execution
  const report = await runStoragePruner({ dryRun: true });
  assert.equal(report.dryRun, true);
  assert.equal(report.status, 'HEALTHY');
  assert.ok(report.databasesScanned > 0);
  assert.equal(typeof report.totalFreedBytes, 'number');
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
    { file: 'scripts/schedule-task-wrapper-Storage-Pruner.ps1', name: 'Storage-Pruner' },
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

test('getHostHeartbeat returns within 100ms on repeated calls using internal cache', async () => {
  const { getHostHeartbeat } = await import('../scripts/ironbots-daily-reporter.mjs');
  const t0 = Date.now();
  const first = getHostHeartbeat();
  const firstDuration = Date.now() - t0;

  const t1 = Date.now();
  const second = getHostHeartbeat();
  const secondDuration = Date.now() - t1;

  assert.ok(secondDuration < 100, `Second call should be cached and fast, took ${secondDuration}ms`);
  assert.equal(typeof second.hostname, 'string');
  assert.equal(typeof second.taskScheduler.status, 'string');
});

test('trm-ingress-watcher processes standalone .gdoc cards via filename metadata extraction', async () => {
  const { parseGDocFilenameMetadata, processGDocStub } = await import('../scripts/trm-ingress-watcher.mjs');
  
  const filename = '2099-01-01T000000Z__action__act-test-999-synthetic-intent-for-unit-test.md.gdoc';
  const metadata = parseGDocFilenameMetadata(filename);
  
  assert.equal(metadata.id, 'act-test-999-synthetic-intent-for-unit-test');
  assert.equal(metadata.action_type, 'antigravity_triage');
  assert.equal(metadata.intent, 'act_test_999_synthetic_intent_for_unit_test');
  assert.equal(metadata.source, 'mobile-gemini-gdoc');

  const tempInbox = path.join(REPO_ROOT, 'logs', `test-gdoc-standalone-${Date.now()}`);
  fs.mkdirSync(tempInbox, { recursive: true });

  const gdocPath = path.join(tempInbox, filename);
  fs.writeFileSync(gdocPath, '{"doc_id":"test-standalone"}', 'utf8');

  const dryResult = processGDocStub(gdocPath, tempInbox, { dryRun: true });
  assert.ok(dryResult);
  assert.equal(dryResult.status, 'STAGED_STANDALONE_GDOC_DRY_RUN');

  fs.rmSync(tempInbox, { recursive: true, force: true });
});

test('git-push-and-wait Test-CheckCompleted does not treat legacy EXPECTED state as completed', () => {
  const gateScript = path.join(REPO_ROOT, 'scripts', 'git-push-and-wait.ps1');
  const content = fs.readFileSync(gateScript, 'utf8');

  const fnMatch = content.match(/function Test-CheckCompleted\([\s\S]*?\n}/);
  assert.ok(fnMatch, 'Test-CheckCompleted function should exist');
  assert.doesNotMatch(
    fnMatch[0],
    /'EXPECTED'/,
    'Test-CheckCompleted must not treat a pending/EXPECTED status context as completed, ' +
      'or the all-checks-done gate can pass before a required check has run'
  );
});

test('retro-full-audit freshness and report steps sort retro files numerically, not alphabetically', () => {
  const workflowPath = path.join(REPO_ROOT, '.github', 'workflows', 'retro-full-audit.yml');
  assert.ok(fs.existsSync(workflowPath), 'retro-full-audit.yml should exist');

  const content = fs.readFileSync(workflowPath, 'utf8');
  const sortLines = content.match(/Sort-Object.*$/gm) ?? [];
  assert.ok(sortLines.length > 0, 'expected at least one Sort-Object call selecting the newest retro');
  for (const line of sortLines) {
    assert.doesNotMatch(
      line,
      /Sort-Object Name\s*\|/,
      'sorting retro filenames alphabetically mis-orders same-day retros once the counter ' +
        'reaches two digits (e.g. "-10" sorts before "-2"); sort by parsed (date, numeric counter) instead'
    );
  }
});

test('notebook-ingester-bot telemetry exports packWarnings array for KIS-P budget safeguards', () => {
  const reportPath = path.join(REPO_ROOT, '_status-feed', 'notebook_ingester_report.json');
  assert.ok(fs.existsSync(reportPath), 'notebook_ingester_report.json should exist');

  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  assert.ok(Array.isArray(report.packWarnings), 'packWarnings should be an array');
});

test('kb-sentinel-bot enforces canonical category and status schema whitelists', () => {
  const scriptPath = path.join(REPO_ROOT, 'scripts', 'kb-sentinel-bot.mjs');
  const content = fs.readFileSync(scriptPath, 'utf8');

  assert.match(content, /ALLOWED_CATEGORIES/);
  assert.match(content, /ALLOWED_STATUSES/);
  assert.match(content, /sanitizeExistingFrontmatter/);
});

test('ironledger-sentinel-bot is integrated into ironbots fleet and daily reporter', async () => {
  const { REQUIRED_FLEET_TASKS, FLEET_SCORING_POLICY } = await import('../scripts/ironbots-daily-reporter.mjs');
  assert.ok(REQUIRED_FLEET_TASKS.includes('IronLedger-Sentinel'), 'IronLedger-Sentinel should be in REQUIRED_FLEET_TASKS');
  assert.equal(typeof FLEET_SCORING_POLICY.weights.ironledgerUnhealthyPenalty, 'number');

  const sentinelScript = path.join(REPO_ROOT, 'scripts', 'ironledger-sentinel-bot.mjs');
  assert.ok(fs.existsSync(sentinelScript), 'ironledger-sentinel-bot.mjs should exist');
});

test('ironledger-sentinel-bot stores post-heal probe in telemetry upon recovery', async () => {
  const { runIronLedgerSentinel } = await import('../scripts/ironledger-sentinel-bot.mjs');
  assert.equal(typeof runIronLedgerSentinel, 'function');

  // Verify dryRun / checkOnly produces well-formed workbench telemetry
  const report = await runIronLedgerSentinel({ checkOnly: true, dryRun: true });
  assert.ok(report);
  assert.ok(report.workbench);
  assert.equal(typeof report.workbench.uiOk, 'boolean');
  assert.equal(typeof report.workbench.healthzOk, 'boolean');
  assert.equal(typeof report.workbench.readyzOk, 'boolean');
});


