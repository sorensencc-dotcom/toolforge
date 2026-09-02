#!/usr/bin/env node
// ==============================================================================
// Daily Multi-Notebook Research & Mining Orchestrator (v3.0)
// Executes automated daily closed-loop research, extraction, pack consolidation,
// validation, and NotebookLM synchronization across all canonical categories.
// ==============================================================================

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadCategoriesData } from '../kb-sync/core/config.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const FREEZE_FILE = path.join(ROOT_DIR, 'freeze.mining');
const LOGS_DIR = path.join(ROOT_DIR, 'logs', 'mining');
const DEAD_LETTER_DIR = path.join(ROOT_DIR, '.nlm_pack_dead_letter');
const PACKS_DIR = path.join(ROOT_DIR, '.nlm_pack');
const PIPELINE_CONFIG_PATH = path.join(ROOT_DIR, 'kb-sync', 'core', 'research_pipeline.json');
const LOG_JSON_PATH = path.join(ROOT_DIR, 'wiki', 'Log.json');
const LOG_MD_PATH = path.join(ROOT_DIR, 'wiki', 'Log.md');

const COLOR = { red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', reset: '\x1b[0m' };
const logInfo = (msg) => console.log(`${COLOR.green}[DAILY-MINER] [INFO]${COLOR.reset} ${msg}`);
const logWarn = (msg) => console.log(`${COLOR.yellow}[DAILY-MINER] [WARN]${COLOR.reset} ${msg}`);
const logError = (msg) => console.error(`${COLOR.red}[DAILY-MINER] [ERROR]${COLOR.reset} ${msg}`);

export function emitTelemetryEvent(runId, dateStr, category, phase, status, metrics = {}) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
  const event = {
    run_id: runId,
    timestamp: new Date().toISOString(),
    category,
    phase,
    status,
    metrics
  };
  const logFile = path.join(LOGS_DIR, `mining-${dateStr}.jsonl`);
  try {
    fs.appendFileSync(logFile, JSON.stringify(event) + '\n', 'utf8');
  } catch (_) {}
}

export function validateDAGSequence(phases) {
  const expected = ['load-category', 'harvest', 'extract-properties', 'consolidate-pack', 'validate-pack', 'sync-notebooklm'];
  for (let i = 0; i < phases.length; i++) {
    if (phases[i] !== expected[i]) {
      throw new Error(`DAG_VALIDATION_ERROR: Phase mismatch at index ${i}: expected '${expected[i]}', got '${phases[i]}'`);
    }
  }
  return true;
}

export async function runDailyMiningPipeline(options = {}) {
  const isDryRun = options.dryRun || process.argv.includes('--dry-run');
  const simulatePackError = options.simulatePackError || process.argv.includes('--simulate-pack-error');
  const maxRetries = options.nlmRetries || 3;
  const backoffMs = options.nlmBackoffMs || 3000;

  const startTime = Date.now();
  const dateStr = new Date().toISOString().slice(0, 10);
  const runUuid = crypto.randomUUID().slice(0, 8);
  const runId = `RUN-${new Date().toISOString().replace(/[:.]/g, '-')}-${runUuid}`;

  console.log(`\n${COLOR.cyan}======================================================================${COLOR.reset}`);
  console.log(`${COLOR.cyan}      CIC DAILY MULTI-NOTEBOOK RESEARCH MINING ORCHESTRATOR           ${COLOR.reset}`);
  console.log(`${COLOR.cyan}======================================================================${COLOR.reset}`);
  logInfo(`Run ID:        ${runId}`);
  logInfo(`Date:          ${dateStr}`);
  logInfo(`Dry Run Mode:  ${isDryRun ? 'ENABLED (Skipping Live NLM Upload)' : 'DISABLED (Live)'}\n`);

  // 1. Freeze Check
  if (fs.existsSync(FREEZE_FILE)) {
    logWarn(`[FREEZE] Kill switch detected at ${FREEZE_FILE}. Aborting mining run cleanly.`);
    emitTelemetryEvent(runId, dateStr, 'global', 'init', 'frozen', { reason: 'freeze.mining exists' });
    return { status: 'frozen', runId };
  }

  // 2. Validate DAG
  const phases = ['load-category', 'harvest', 'extract-properties', 'consolidate-pack', 'validate-pack', 'sync-notebooklm'];
  validateDAGSequence(phases);
  logInfo(`✓ Execution DAG validated: ${phases.join(' -> ')}`);

  // 3. Load Categories
  const catData = loadCategoriesData();
  const categories = Object.entries(catData.categories || {});
  logInfo(`Loaded ${categories.length} canonical categories from categories.json.`);

  // 4. Global Harvesting & Property Extraction Pass
  logInfo('Step A: Executing Live Web Deep Harvester across categories...');
  try {
    execSync(`node "${path.join(__dirname, 'trm-web-harvester.mjs')}" --all-categories`, { stdio: 'inherit' });
    emitTelemetryEvent(runId, dateStr, 'all', 'harvest', 'success');
  } catch (err) {
    logWarn(`Harvester step completed with warnings: ${err.message}`);
    emitTelemetryEvent(runId, dateStr, 'all', 'harvest', 'warning', { error: err.message });
  }

  logInfo('Step B: Executing Property & Deed Record Extractor...');
  try {
    execSync(`node "${path.join(__dirname, 'extract-property-records.mjs')}"`, { stdio: 'inherit' });
    emitTelemetryEvent(runId, dateStr, 'all', 'extract-properties', 'success');
  } catch (err) {
    logWarn(`Property extraction completed with warnings: ${err.message}`);
    emitTelemetryEvent(runId, dateStr, 'all', 'extract-properties', 'warning', { error: err.message });
  }

  // 5. Compile & Consolidate Thematic Packs
  logInfo('Step C: Consolidating Thematic Knowledge Packs...');
  try {
    execSync(`node "${path.join(__dirname, 'consolidate-pack.mjs')}"`, { stdio: 'inherit' });
    emitTelemetryEvent(runId, dateStr, 'all', 'consolidate-pack', 'success');
  } catch (err) {
    logError(`Pack consolidation failed: ${err.message}`);
    emitTelemetryEvent(runId, dateStr, 'all', 'consolidate-pack', 'error', { error: err.message });
  }

  // 6. Per-Category Fault-Isolated Validation & Sync Loop
  logInfo('Step D: Per-Category Pack Validation & NotebookLM Sync Loop...');
  const categoryResults = [];

  for (const [catName, catDef] of categories) {
    const catStartTime = Date.now();
    const targetUuid = catDef.target;
    const packSlug = catName.replace(/-/g, '_');
    const packFile = path.join(PACKS_DIR, `pack_${packSlug}.txt`);

    logInfo(`\n>>> Processing Category: [${catName}] (Target: ${targetUuid})`);

    if (!fs.existsSync(packFile)) {
      logWarn(`  No pack file found at ${packFile}. Skipping category sync.`);
      emitTelemetryEvent(runId, dateStr, catName, 'validate-pack', 'skipped', { reason: 'no_pack_file' });
      categoryResults.push({ category: catName, status: 'skipped', reason: 'no pack file' });
      continue;
    }

    // Pack Validation
    let validationPassed = false;
    if (simulatePackError && catName === 'cuban-seizures') {
      logWarn(`  [SIMULATION] Injecting validation failure for ${catName} to test Dead-Letter Queue...`);
    } else {
      try {
        execSync(`pwsh -NoProfile -File "${path.join(__dirname, 'validate-pack.ps1')}" -Pack "${packFile}"`, { stdio: 'pipe' });
        validationPassed = true;
        logInfo(`  ✓ Pack validation passed for ${path.basename(packFile)}.`);
        emitTelemetryEvent(runId, dateStr, catName, 'validate-pack', 'success');
      } catch (valErr) {
        logError(`  ✗ Validation failed for pack ${path.basename(packFile)}: ${valErr.message}`);
      }
    }

    if (!validationPassed) {
      // Quarantine to Dead-Letter Queue
      const deadLetterCatDir = path.join(DEAD_LETTER_DIR, dateStr, catName);
      fs.mkdirSync(deadLetterCatDir, { recursive: true });
      const deadLetterFile = path.join(deadLetterCatDir, path.basename(packFile));
      try { fs.copyFileSync(packFile, deadLetterFile); } catch (_) {}

      logWarn(`  ⚠ Quarantined failed pack to Dead-Letter Queue: ${deadLetterFile}`);
      emitTelemetryEvent(runId, dateStr, catName, 'validate-pack', 'quarantined', { dead_letter: deadLetterFile });
      categoryResults.push({ category: catName, status: 'quarantined', deadLetter: deadLetterFile });
      continue; // Mining safety gate: Never sync unvalidated pack
    }

    // Sync to NotebookLM
    if (isDryRun) {
      logInfo(`  [DRY-RUN] Simulating NotebookLM sync -> ${catDef.title} (${targetUuid}).`);
      emitTelemetryEvent(runId, dateStr, catName, 'sync-notebooklm', 'simulated_success');
      categoryResults.push({ category: catName, status: 'dry_run_success', durationMs: Date.now() - catStartTime });
    } else {
      let uploadSuccess = false;
      let attempt = 0;

      while (attempt < maxRetries && !uploadSuccess) {
        attempt++;
        try {
          logInfo(`  Uploading pack to NotebookLM (Attempt ${attempt}/${maxRetries})...`);
          execSync(`nlm source add "${targetUuid}" --file "${packFile}" --title "${catDef.title} Pack" --wait`, { stdio: 'inherit' });
          uploadSuccess = true;
          logInfo(`  ✓ Successfully uploaded pack to NotebookLM: ${catDef.title}`);
          emitTelemetryEvent(runId, dateStr, catName, 'sync-notebooklm', 'success', { attempt });
        } catch (uploadErr) {
          logWarn(`  Upload attempt ${attempt} failed: ${uploadErr.message}`);
          if (attempt < maxRetries) {
            logInfo(`  Waiting ${backoffMs}ms before retry...`);
            execSync(`node -e "setTimeout(() => {}, ${backoffMs})"`);
          }
        }
      }

      if (uploadSuccess) {
        categoryResults.push({ category: catName, status: 'synced', attempts: attempt, durationMs: Date.now() - catStartTime });
      } else {
        logError(`  ✗ Failed to upload ${catName} after ${maxRetries} attempts.`);
        emitTelemetryEvent(runId, dateStr, catName, 'sync-notebooklm', 'failed', { max_attempts: maxRetries });
        categoryResults.push({ category: catName, status: 'failed_upload' });
      }
    }
  }

  // 7. Audit & Summary Logging
  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
  logInfo(`\n======================================================================`);
  logInfo(`Mining run ${runId} finished in ${totalDuration}s.`);
  console.table(categoryResults);

  // Append to Audit Logs
  const auditRecord = {
    timestamp: new Date().toISOString(),
    action: 'daily_mining_run',
    actor: 'scheduler',
    run_id: runId,
    duration_seconds: parseFloat(totalDuration),
    results: categoryResults,
    result: 'success'
  };

  try {
    let logs = [];
    if (fs.existsSync(LOG_JSON_PATH)) logs = JSON.parse(fs.readFileSync(LOG_JSON_PATH, 'utf8'));
    logs.push(auditRecord);
    fs.writeFileSync(LOG_JSON_PATH, JSON.stringify(logs, null, 2), 'utf8');

    const mdSummary = `\n## ${auditRecord.timestamp} - Daily Research Mining Run (${runId})\n- **Duration:** ${totalDuration}s\n- **Dry Run:** ${isDryRun}\n- **Categories Processed:** ${categoryResults.map(r => `${r.category} (${r.status})`).join(', ')}\n`;
    fs.appendFileSync(LOG_MD_PATH, mdSummary, 'utf8');
  } catch (_) {}

  return { runId, totalDuration, results: categoryResults };
}

const mainFile = process.argv[1] ? fs.realpathSync(process.argv[1]) : '';
const thisFile = fs.realpathSync(__filename);
if (mainFile === thisFile) {
  runDailyMiningPipeline().catch(err => {
    logError(`Fatal mining orchestrator error: ${err.message}`);
    process.exit(1);
  });
}
