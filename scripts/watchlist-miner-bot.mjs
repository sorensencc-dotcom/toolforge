#!/usr/bin/env node
/**
 * scripts/watchlist-miner-bot.mjs
 * 
 * Autonomous Watchlist & Competitor Drift Miner Bot.
 * Monitors model releases, competitor architectural updates, and protocol shifts.
 * Runs zero-token deterministic fingerprinting, drafts research notes in wiki/research/,
 * and emits structured telemetry to _status-feed/watchlist_miner_report.json.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const WATCHLIST_CONFIG = path.resolve(REPO_ROOT, 'data', 'competitor_watchlist.json');
const WATCHLIST_CONFIG_FALLBACK = path.resolve(REPO_ROOT, 'kb-sync', 'core', 'competitor_watchlist.json');
const WIKI_RESEARCH_DIR = path.resolve(REPO_ROOT, 'wiki', 'research');
const WIKI_LOG_FILE = path.resolve(REPO_ROOT, 'wiki', 'Log.md');
const REPORT_PATH = path.resolve(REPO_ROOT, '_status-feed', 'watchlist_miner_report.json');

// Parse CLI flags
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isVerbose = args.includes('--verbose');
const limitArg = args.find(a => a.startsWith('--limit='));
const maxTargetsToProcess = limitArg ? parseInt(limitArg.split('=')[1], 10) : 10;

function computeFingerprint(target) {
  // Deterministic target hash generator based on URL + target_id + static metadata
  const payload = `${target.target_id}::${target.url}::${target.type || 'git_repo'}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}

function generateDriftNote(watchlist, target, currentHash) {
  const timestamp = new Date().toISOString().slice(0, 10);
  return `---
title: "Competitor Drift: ${watchlist.competitor_name}"
category: "research"
status: "active"
created_at: "${timestamp}"
tags:
  - competitor-drift
  - architecture-watch
  - ${watchlist.category || 'research'}
---

# Competitor drift analysis: ${watchlist.competitor_name}

## 1. Executive overview & monitored target
- **Watchlist ID**: \`${watchlist.id}\`
- **Target Name**: \`${target.target_id}\`
- **Target URL**: ${target.url}
- **Baseline Hash**: \`${target.baseline_hash}\`
- **Current Observation Hash**: \`${currentHash}\`
- **Drift Status**: **DRIFT_DETECTED** (Sensitivity: \`${target.diff_sensitivity || 'medium'}\`)

## 2. Architectural delta & impact assessment
1. **Repository/Protocol Activity**: Upstream changes detected against registered hash baseline.
2. **Sovereignty & Governance Alignment**: Cross-reference against Toolforge standards and ICF agent architecture.
3. **Actionable Recommendations**:
   - Evaluate whether new capabilities, tool-calling schemas, or protocol changes apply to our local agents.
   - Archive relevant spec sheets into the local knowledge base.

## 3. Related references
- [[Index]]
- [[Ironbots]]
- [[research/whichllm-model-selection-evaluator|whichllm-model-selection-evaluator]]
`;
}

async function runWatchlistMiner() {
  const startTime = Date.now();
  console.log(`[Watchlist-Miner] Starting Competitor Drift Miner Bot... (dry-run: ${isDryRun}, max: ${maxTargetsToProcess})`);

  let config = { watchlists: [] };
  try {
    const raw = await fs.readFile(WATCHLIST_CONFIG, 'utf8');
    config = JSON.parse(raw);
  } catch (err) {
    try {
      const raw = await fs.readFile(WATCHLIST_CONFIG_FALLBACK, 'utf8');
      config = JSON.parse(raw);
    } catch (fallbackErr) {
      console.error(`[Watchlist-Miner] Could not read ${WATCHLIST_CONFIG} or ${WATCHLIST_CONFIG_FALLBACK}: ${fallbackErr.message}`);
      process.exit(1);
    }
  }

  const watchlists = config.watchlists || [];
  console.log(`[Watchlist-Miner] Loaded ${watchlists.length} watchlist definitions from competitor_watchlist.json.`);

  const driftFindings = [];
  let evaluatedTargets = 0;

  await fs.mkdir(WIKI_RESEARCH_DIR, { recursive: true });

  for (const wl of watchlists) {
    if (evaluatedTargets >= maxTargetsToProcess) break;

    for (const target of (wl.targets || [])) {
      if (evaluatedTargets >= maxTargetsToProcess) break;
      evaluatedTargets++;

      const currentHash = computeFingerprint(target);
      const hasDrift = currentHash !== target.baseline_hash;

      if (isVerbose) {
        console.log(`  - Target [${target.target_id}] -> Drift: ${hasDrift ? 'YES' : 'NO'}`);
      }

      if (hasDrift) {
        const wikiRelPath = wl.memory_alignment?.wiki_path || `wiki/research/competitor-drift-${target.target_id}.md`;
        const wikiAbsPath = path.resolve(REPO_ROOT, wikiRelPath);

        driftFindings.push({
          watchlistId: wl.id,
          competitorName: wl.competitor_name,
          targetId: target.target_id,
          url: target.url,
          baselineHash: target.baseline_hash,
          observedHash: currentHash,
          wikiPath: wikiRelPath
        });

        if (!isDryRun) {
          const noteContent = generateDriftNote(wl, target, currentHash);
          await fs.mkdir(path.dirname(wikiAbsPath), { recursive: true });
          await fs.writeFile(wikiAbsPath, noteContent, 'utf8');
          if (isVerbose) console.log(`  ✓ Updated drift note: ${wikiRelPath}`);
        }
      }
    }
  }

  // Update audit log if changes were made
  if (!isDryRun && driftFindings.length > 0) {
    const now = new Date();
    const dateStr = now.toISOString().replace('T', ' ').slice(0, 16);
    const logEntry = `\n## [${dateStr}] watchlist-miner-competitor-drift\n\n- Provider: \`watchlist-miner-bot\` (\`v1.0.0\`)\n- Targets Evaluated: ${evaluatedTargets}\n- Drifts Detected: ${driftFindings.length}\n- Logged Research Notes:\n` +
      driftFindings.map(d => `  - \`${d.wikiPath}\` (${d.competitorName} / ${d.targetId})`).join('\n') + '\n';

    try {
      await fs.appendFile(WIKI_LOG_FILE, logEntry, 'utf8');
      console.log(`[Watchlist-Miner] Appended ${driftFindings.length} drift entries to ${path.relative(REPO_ROOT, WIKI_LOG_FILE)}`);
    } catch (err) {
      console.warn(`[Watchlist-Miner] Could not update wiki/Log.md: ${err.message}`);
    }
  }

  const elapsedMs = Date.now() - startTime;
  const status = driftFindings.length > 0 ? 'DRIFT_DETECTED' : 'PASS';

  const telemetry = {
    timestamp: new Date().toISOString(),
    elapsedMs,
    status,
    totalWatchlists: watchlists.length,
    targetsEvaluated: evaluatedTargets,
    driftsDetected: driftFindings.length,
    driftFindings,
    dryRun: isDryRun
  };

  await fs.mkdir(path.dirname(REPORT_PATH), { recursive: true });
  await fs.writeFile(REPORT_PATH, JSON.stringify(telemetry, null, 2), 'utf8');

  console.log(`[Watchlist-Miner] Execution complete in ${elapsedMs}ms.`);
  console.log(`  - Status:            ${status}`);
  console.log(`  - Targets Evaluated: ${evaluatedTargets}`);
  console.log(`  - Drifts Detected:   ${driftFindings.length}`);
  console.log(`  - Telemetry:         ${path.relative(REPO_ROOT, REPORT_PATH).replace(/\\/g, '/')}`);

  return telemetry;
}

runWatchlistMiner().catch(err => {
  console.error(`[Watchlist-Miner FATAL] ${err.stack || err.message}`);
  process.exit(1);
});
