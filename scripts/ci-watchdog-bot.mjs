#!/usr/bin/env node
/**
 * scripts/ci-watchdog-bot.mjs
 * 
 * Autonomous GitHub Actions & Delivery-Guard CI Watchdog Bot.
 * Monitors recent remote workflow runs via gh CLI, extracts root-cause failures,
 * and maintains structured alerts in _status-feed/ci_alerts.json.
 * Zero-token deterministic execution.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const REPORT_PATH = path.resolve(REPO_ROOT, '_status-feed', 'ci_alerts.json');

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isVerbose = args.includes('--verbose');

function getRecentWorkflowRuns(limit = 5) {
  try {
    const raw = execFileSync('gh', [
      'run',
      'list',
      '--limit',
      String(limit),
      '--json',
      'databaseId,name,status,conclusion,headBranch,headSha,url,createdAt'
    ], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    });
    return JSON.parse(raw);
  } catch (err) {
    if (isVerbose) console.warn(`[CI-Watchdog] gh CLI query failed: ${err.message}`);
    return [];
  }
}

function getFailedRunLogSummary(runId) {
  try {
    const log = execFileSync('gh', [
      'run',
      'view',
      String(runId),
      '--log-failed'
    ], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    });

    // Extract error snippets (lines containing error, fail, or policy block)
    const lines = log.split(/\r?\n/);
    const errorSnippets = lines
      .filter(l => /error|fail|decision.*block|Process completed with exit code/i.test(l))
      .slice(0, 8);

    return errorSnippets.length > 0 ? errorSnippets : ['Failed without captured stdout snippet'];
  } catch {
    return ['Could not retrieve failed log via gh CLI'];
  }
}

async function runCiWatchdog() {
  const startTime = Date.now();
  console.log(`[CI-Watchdog] Checking remote CI and GitHub Actions status... (dry-run: ${isDryRun})`);

  const runs = getRecentWorkflowRuns(6);
  const activeRuns = runs.filter(r => r.status === 'in_progress' || r.status === 'queued');
  const completedRuns = runs.filter(r => r.status === 'completed');
  const failedRuns = completedRuns.filter(r => r.conclusion === 'failure');

  const alerts = [];

  for (const failed of failedRuns) {
    const errorSnippet = getFailedRunLogSummary(failed.databaseId);
    alerts.push({
      runId: failed.databaseId,
      name: failed.name,
      branch: failed.headBranch,
      sha: failed.headSha ? failed.headSha.slice(0, 8) : 'unknown',
      url: failed.url,
      createdAt: failed.createdAt,
      errorSummary: errorSnippet
    });
  }

  const status = failedRuns.length === 0 ? 'HEALTHY' : 'FAILURES_DETECTED';
  const elapsedMs = Date.now() - startTime;

  console.log(`[CI-Watchdog] Scanned ${runs.length} recent runs in ${elapsedMs}ms.`);
  console.log(`  - Active / In-Progress: ${activeRuns.length}`);
  console.log(`  - Recent Failures: ${failedRuns.length}`);
  console.log(`  - Status: ${status}`);

  const report = {
    timestamp: new Date().toISOString(),
    elapsedMs,
    status,
    scannedCount: runs.length,
    activeCount: activeRuns.length,
    failureCount: failedRuns.length,
    recentRuns: runs.map(r => ({
      id: r.databaseId,
      name: r.name,
      branch: r.headBranch,
      status: r.status,
      conclusion: r.conclusion
    })),
    alerts,
    dryRun: isDryRun
  };

  await fs.mkdir(path.dirname(REPORT_PATH), { recursive: true });
  await fs.writeFile(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');

  console.log(`  - Telemetry written to: ${path.relative(REPO_ROOT, REPORT_PATH).replace(/\\/g, '/')}`);
  return report;
}

runCiWatchdog().catch(err => {
  console.error(`[CI-Watchdog FATAL] ${err.stack || err.message}`);
  process.exit(1);
});
