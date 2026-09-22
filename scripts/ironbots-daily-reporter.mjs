#!/usr/bin/env node
/**
 * scripts/ironbots-daily-reporter.mjs
 * 
 * Autonomous Daily Fleet Activity Aggregator & Reporter Bot.
 * Ingests telemetry from all 6 Ironbots in _status-feed/, computes overall fleet health,
 * compiles daily JSON metrics, archives historical snapshots, and updates wiki reports.
 * 
 * Zero token footprint.
 */

import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const STATUS_FEED_DIR = path.resolve(REPO_ROOT, '_status-feed');
const DAILY_REPORT_PATH = path.resolve(STATUS_FEED_DIR, 'ironbots_daily_report.json');
const HISTORY_DIR = path.resolve(STATUS_FEED_DIR, 'ironbots_history');
const WIKI_REPORT_PATH = path.resolve(REPO_ROOT, 'wiki', 'research', 'ironbots-daily-report.md');
const WIKI_LOG_FILE = path.resolve(REPO_ROOT, 'wiki', 'Log.md');

// Parse CLI flags
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isVerbose = args.includes('--verbose');

const BOT_ARTIFACTS = {
  notebookIngester: 'notebook_ingester_report.json',
  kbSentinel: 'kb_sentinel_report.json',
  trmBot: 'trm_bot_report.json',
  watchlistMiner: 'watchlist_miner_report.json',
  daemonHealer: 'daemon_health.json',
  ciWatchdog: 'ci_alerts.json'
};

export const FLEET_SCORING_POLICY = {
  weights: {
    kbSentinelPenaltyFactor: 0.3,
    ciFailurePenaltyPerRun: 10,
    maxCiFailurePenalty: 25,
    daemonUnhealthyPenalty: 20,
    competitorDriftPenalty: 5
  },
  thresholds: {
    healthyMinScore: 85,
    attentionMinScore: 60
  }
};

async function readJsonSafe(filePath, defaultVal = null) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return defaultVal;
  }
}

export async function aggregateFleetActivity(options = {}) {
  const startTime = Date.now();
  const dateStr = new Date().toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();

  const results = {};
  for (const [key, filename] of Object.entries(BOT_ARTIFACTS)) {
    const artifactPath = path.join(STATUS_FEED_DIR, filename);
    results[key] = await readJsonSafe(artifactPath, { status: 'UNKNOWN', missing: true });
  }

  // Calculate fleet metrics
  const activeBots = [
    {
      id: 'notebook-ingester',
      name: 'NotebookLM & Knowledge Ingester',
      schedule: 'Daily 02:00 AM',
      telemetry: results.notebookIngester,
      status: results.notebookIngester?.status || 'UNKNOWN',
      summary: results.notebookIngester?.totalFiles ? `${results.notebookIngester.totalFiles} documents indexed into SQLite FTS5` : 'No run recorded'
    },
    {
      id: 'kb-sentinel',
      name: 'KB-Sentinel Drift & Autoheal',
      schedule: 'Daily 03:00 AM',
      telemetry: results.kbSentinel,
      status: results.kbSentinel?.status || 'UNKNOWN',
      summary: results.kbSentinel?.healthScore !== undefined ? `Health Score: ${results.kbSentinel.healthScore}/100 (${results.kbSentinel.scanned || 0} files scanned)` : 'No run recorded'
    },
    {
      id: 'trm-bot',
      name: 'TRM Gap Triage & RFC Drafter',
      schedule: 'Daily 04:00 AM',
      telemetry: results.trmBot,
      status: results.trmBot?.totalGaps !== undefined ? 'PASS' : 'UNKNOWN',
      summary: results.trmBot?.totalGaps !== undefined ? `${results.trmBot.totalGaps} total gaps (${results.trmBot.drafted || 0} drafted)` : 'No run recorded'
    },
    {
      id: 'watchlist-miner',
      name: 'Watchlist & Competitor Drift Miner',
      schedule: 'Daily 05:00 AM',
      telemetry: results.watchlistMiner,
      status: results.watchlistMiner?.status || 'UNKNOWN',
      summary: results.watchlistMiner?.targetsEvaluated !== undefined ? `${results.watchlistMiner.targetsEvaluated} targets evaluated (${results.watchlistMiner.driftsDetected || 0} drifts)` : 'No run recorded'
    },
    {
      id: 'daemon-healer',
      name: 'Daemon-Healer Port 8080 Supervisor',
      schedule: 'Every 15 Min',
      telemetry: results.daemonHealer,
      status: results.daemonHealer?.status || 'UNKNOWN',
      summary: results.daemonHealer?.targetUrl ? `Port 8080 status: ${results.daemonHealer.status} (healed: ${results.daemonHealer.healed})` : 'No run recorded'
    },
    {
      id: 'ci-watchdog',
      name: 'CI-Watchdog Workflow Failure Triage',
      schedule: 'Daily 06:00 AM',
      telemetry: results.ciWatchdog,
      status: results.ciWatchdog?.status || 'UNKNOWN',
      summary: results.ciWatchdog?.scannedCount !== undefined ? `${results.ciWatchdog.scannedCount} runs scanned (${results.ciWatchdog.failureCount || 0} failures)` : 'No run recorded'
    }
  ];

  // Compute overall fleet health score (0–100)
  let healthPenalties = 0;
  if (results.kbSentinel?.healthScore) {
    healthPenalties += Math.max(0, 100 - results.kbSentinel.healthScore) * FLEET_SCORING_POLICY.weights.kbSentinelPenaltyFactor;
  }
  if (results.ciWatchdog?.failureCount > 0) {
    healthPenalties += Math.min(
      FLEET_SCORING_POLICY.weights.maxCiFailurePenalty,
      results.ciWatchdog.failureCount * FLEET_SCORING_POLICY.weights.ciFailurePenaltyPerRun
    );
  }
  if (results.daemonHealer?.status !== 'HEALTHY' && results.daemonHealer?.status !== 'RECOVERED') {
    healthPenalties += FLEET_SCORING_POLICY.weights.daemonUnhealthyPenalty;
  }
  if (results.watchlistMiner?.driftsDetected > 0) {
    healthPenalties += FLEET_SCORING_POLICY.weights.competitorDriftPenalty;
  }

  const fleetHealthScore = Math.max(0, Math.min(100, Math.round(100 - healthPenalties)));
  let fleetStatus = 'HEALTHY';
  if (fleetHealthScore < FLEET_SCORING_POLICY.thresholds.healthyMinScore) fleetStatus = 'DEGRADED';
  if (fleetHealthScore < FLEET_SCORING_POLICY.thresholds.attentionMinScore) fleetStatus = 'ATTENTION_REQUIRED';

  const elapsedMs = Date.now() - startTime;

  const dailyReport = {
    date: dateStr,
    timestamp: nowIso,
    elapsedMs,
    fleetHealthScore,
    fleetStatus,
    botCount: activeBots.length,
    activeBots,
    summaryMetrics: {
      totalDocsIndexed: results.notebookIngester?.totalFiles || 0,
      wikiHealthScore: results.kbSentinel?.healthScore || 100,
      totalResearchGaps: results.trmBot?.totalGaps || 0,
      competitorDrifts: results.watchlistMiner?.driftsDetected || 0,
      daemonStatus: results.daemonHealer?.status || 'UNKNOWN',
      ciFailures: results.ciWatchdog?.failureCount || 0
    },
    dryRun: isDryRun
  };

  if (!isDryRun) {
    // Write primary report and archive daily snapshot
    await fs.mkdir(STATUS_FEED_DIR, { recursive: true });
    await fs.mkdir(HISTORY_DIR, { recursive: true });

    await fs.writeFile(DAILY_REPORT_PATH, JSON.stringify(dailyReport, null, 2), 'utf8');
    const historyFile = path.join(HISTORY_DIR, `${dateStr}.json`);
    await fs.writeFile(historyFile, JSON.stringify(dailyReport, null, 2), 'utf8');

    // Update markdown wiki summary
    const markdownContent = generateMarkdownReport(dailyReport);
    await fs.mkdir(path.dirname(WIKI_REPORT_PATH), { recursive: true });
    await fs.writeFile(WIKI_REPORT_PATH, markdownContent, 'utf8');

    // Append to Log.md
    const dateFormatted = nowIso.replace('T', ' ').slice(0, 16);
    const logEntry = `\n## [${dateFormatted}] ironbots-daily-fleet-report\n\n- Provider: \`ironbots-daily-reporter\` (\`v1.0.0\`)\n- Fleet Health: ${fleetHealthScore}/100 (${fleetStatus})\n- Active Bots: ${activeBots.length}\n- Telemetry: \`_status-feed/ironbots_daily_report.json\`\n`;
    try {
      await fs.appendFile(WIKI_LOG_FILE, logEntry, 'utf8');
    } catch (_) {}
  }

  return dailyReport;
}

function generateMarkdownReport(report) {
  return `---
title: "Ironbots Daily Fleet Activity Report"
category: "reporting"
status: "active"
created_at: "${report.date}"
tags:
  - ironbots
  - daily-report
  - telemetry
  - fleet-health
---

# Ironbots daily fleet activity report

**Date**: ${report.date} | **Fleet Health Score**: **${report.fleetHealthScore}/100** (\`${report.fleetStatus}\`)

---

## 1. Fleet executive summary
- **Active Bots Supervised**: ${report.botCount} / ${report.botCount}
- **Knowledge Documents Indexed (FTS5)**: ${report.summaryMetrics.totalDocsIndexed}
- **Wiki Health Score**: ${report.summaryMetrics.wikiHealthScore}/100
- **Total Research Gaps Tracked**: ${report.summaryMetrics.totalResearchGaps}
- **Competitor Drifts Flagged**: ${report.summaryMetrics.competitorDrifts}
- **Daemon Port 8080 Health**: \`${report.summaryMetrics.daemonStatus}\`
- **CI Workflow Failures**: ${report.summaryMetrics.ciFailures}

---

## 2. Active bot activity roster

| Bot Name | Schedule | Status | Summary |
|---|---|---|---|
${report.activeBots.map(b => `| **${b.name}** | \`${b.schedule}\` | \`${b.status}\` | ${b.summary} |`).join('\n')}

---

## 3. Related telemetry & logs
- [[Ironbots]]
- [[Index]]
- Primary JSON Feed: \`_status-feed/ironbots_daily_report.json\`
`;
}

async function main() {
  console.log(`[Ironbots-Reporter] Compiling daily fleet telemetry report... (dry-run: ${isDryRun})`);
  const report = await aggregateFleetActivity({ isDryRun, isVerbose });
  console.log(`[Ironbots-Reporter] Fleet Report Compiled in ${report.elapsedMs}ms.`);
  console.log(`  - Fleet Health: ${report.fleetHealthScore}/100 (${report.fleetStatus})`);
  console.log(`  - Bots Scanned: ${report.botCount}`);
  console.log(`  - Artifact:     _status-feed/ironbots_daily_report.json`);
}

const mainFile = process.argv[1] ? fsSync.realpathSync(process.argv[1]) : '';
const thisFile = fsSync.realpathSync(fileURLToPath(import.meta.url));
if (mainFile === thisFile) {
  main().catch(err => {
    console.error(`[Ironbots-Reporter FATAL] ${err.stack || err.message}`);
    process.exit(1);
  });
}
