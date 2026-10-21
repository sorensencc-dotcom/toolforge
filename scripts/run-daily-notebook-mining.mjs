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
import { appendToWikiLog } from './lib/wiki-log-append.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const FREEZE_FILE = path.join(ROOT_DIR, 'freeze.mining');
const LOGS_DIR = path.join(ROOT_DIR, 'logs', 'mining');
const DEAD_LETTER_DIR = path.join(ROOT_DIR, '.nlm_pack_dead_letter');
const PACKS_DIR = path.join(ROOT_DIR, '.nlm_pack');
const PIPELINE_CONFIG_PATH = path.join(ROOT_DIR, 'kb-sync', 'core', 'research_pipeline.json');
const LOG_JSON_PATH = path.join(ROOT_DIR, 'wiki', 'Log.json');

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

const PART_TITLE_RE = /[_-]part[_-]?[a-z0-9]+/i;

// Mirrors kb-sync scripts/nlm-pack-replace-gate.mjs matchesPackFamily for the generic case.
function matchesStem(title, stem) {
  if (!stem) return false;
  return title === stem || ['_', '.', '-'].some(sep => title.startsWith(stem + sep));
}

export function findStaleMiningSources(existingSources, packBaseName, categoryTitle = '') {
  const packStem = (packBaseName || '').replace(/\.txt$/, '').toLowerCase();
  const cleanCatTitle = (categoryTitle || '').trim().toLowerCase();
  const targetPackTitle = cleanCatTitle ? `${cleanCatTitle} pack` : '';

  return (existingSources || []).filter(s => {
    const rawName = (s.title || s.name || '').trim().toLowerCase();
    if (!rawName) return false;

    // Multipart members (pack_daily_part1...) belong to kb-sync and are never stale here.
    if (PART_TITLE_RE.test(rawName)) return false;

    // Matches pack filename stem (e.g., "pack_daily", "pack_daily.txt")
    if (matchesStem(rawName, packStem)) return true;

    // Matches category pack title or exact category title
    if (targetPackTitle && rawName === targetPackTitle) return true;
    if (cleanCatTitle && rawName === cleanCatTitle) return true;

    // Matches legacy monolithic repo packs
    if (matchesStem(rawName, 'repo_knowledge_pack')) return true;

    // Matches master-kb variations
    if (packStem.startsWith('pack_master_kb') && (matchesStem(rawName, 'pack_master_kb') || rawName === 'cic-kb pack')) {
      return true;
    }

    return false;
  });
}

export const FALLBACK_PROTECTED_NOTEBOOK_IDS = [
  '1b4861a3-931f-4632-8fc1-343a8dd37df8', // Daily (multipart)
  '679b8bab-2d87-42cb-a726-6dc54c83acc2', // master-kb (multipart)
  '359b346c-6af7-4ba3-baef-b985c9e6e1af', // Agent Harness (multipart, master-written)
];

const DEFAULT_KB_SYNC_ROOT = 'C:\\dev\\kb-sync';

// Every notebook in kb-sync's knowledge-plane registry is kb-sync-managed. Read at runtime so
// a missing kb-sync checkout degrades to the hard-coded fallback set instead of breaking.
export function loadProtectedNotebookIds(env = process.env, readFile = (p) => fs.readFileSync(p, 'utf8')) {
  const ids = new Set(FALLBACK_PROTECTED_NOTEBOOK_IDS);
  const manifestPath = env.KB_SYNC_MANIFEST_PATH
    || path.join(env.KB_SYNC_ROOT || DEFAULT_KB_SYNC_ROOT, 'state', 'knowledge-plane-notebooks.json');
  try {
    const manifest = JSON.parse(readFile(manifestPath));
    for (const cluster of Object.values(manifest.clusters || {})) {
      for (const nb of cluster?.notebooks || []) {
        if (nb?.uuid) ids.add(String(nb.uuid).toLowerCase());
      }
    }
  } catch (_) {}
  return ids;
}

export function isProtectedNotebook(notebookId, protectedIds) {
  return protectedIds.has(String(notebookId || '').toLowerCase());
}

const sourceTitle = (s) => (s.title || s.name || '').trim();

/**
 * Upload first, confirm the new source is present, then prune stale predecessors.
 * deps: { listSources(id) -> [], uploadSource(id, file, title), deleteSource(sourceId) }.
 * Never deletes anything unless the upload was confirmed, and never deletes the new source.
 */
export function syncPackToNotebook({ targetUuid, packFile, packTitle, categoryTitle, deps, log = {} }) {
  const info = log.info || (() => {});
  const warn = log.warn || (() => {});
  const packBaseName = path.basename(packFile);

  let before;
  try {
    before = deps.listSources(targetUuid);
  } catch (e) {
    return { ok: false, reason: 'list_failed', error: e.message };
  }
  const beforeIds = new Set(before.map(s => s.id));
  const staleSources = findStaleMiningSources(before, packBaseName, categoryTitle);

  try {
    deps.uploadSource(targetUuid, packFile, packTitle);
  } catch (e) {
    return { ok: false, reason: 'upload_failed', error: e.message };
  }

  let after;
  try {
    after = deps.listSources(targetUuid);
  } catch (e) {
    return { ok: false, reason: 'confirm_failed', error: e.message };
  }
  const added = after.filter(s => !beforeIds.has(s.id) && sourceTitle(s).toLowerCase() === packTitle.toLowerCase());
  if (added.length === 0) {
    return { ok: false, reason: 'upload_unconfirmed' };
  }
  const keepIds = new Set(added.map(s => s.id));
  const afterIds = new Set(after.map(s => s.id));
  const toPrune = staleSources.filter(s => !keepIds.has(s.id) && afterIds.has(s.id));

  const failures = [];
  if (toPrune.length > 0) info(`Pruning ${toPrune.length} stale previous version(s) after confirmed upload...`);
  for (const stale of toPrune) {
    try {
      deps.deleteSource(stale.id);
      info(`✓ Pruned prior source: ${stale.id} ("${sourceTitle(stale)}")`);
    } catch (e) {
      warn(`Failed to delete stale source ${stale.id}: ${e.message}`);
      failures.push(stale.id);
    }
  }
  if (failures.length > 0) {
    return { ok: false, reason: 'prune_failed', failedDeletes: failures };
  }
  return { ok: true, pruned: toPrune.length };
}

const nlmDeps = {
  listSources(id) {
    const out = execSync(`nlm source list "${id}" --json`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    const parsed = JSON.parse(out);
    return Array.isArray(parsed) ? parsed : (parsed.sources || []);
  },
  uploadSource(id, file, title) {
    execSync(`nlm source add "${id}" --file "${file}" --title "${title}" --wait`, { stdio: 'inherit' });
  },
  deleteSource(sourceId) {
    execSync(`nlm source delete "${sourceId}" -y`, { stdio: ['pipe', 'pipe', 'pipe'] });
  },
};

export async function runDailyMiningPipeline(options = {}) {
  const isDryRun = options.dryRun || process.argv.includes('--dry-run');
  const simulatePackError = options.simulatePackError || process.argv.includes('--simulate-pack-error');
  const maxRetries = options.nlmRetries || 3;
  const backoffMs = options.nlmBackoffMs || 3000;
  const deps = options.nlmDeps || nlmDeps;
  const protectedIds = options.protectedNotebookIds || loadProtectedNotebookIds();
  const sleep = options.sleep || ((ms) => execSync(`node -e "setTimeout(() => {}, ${ms})"`));

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
  const { loadCategoriesData } = await import('../kb-sync/core/config.mjs');
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

    if (isProtectedNotebook(targetUuid, protectedIds)) {
      logWarn(`  Notebook ${targetUuid} is kb-sync-managed (multipart). Skipping category.`);
      emitTelemetryEvent(runId, dateStr, catName, 'sync-notebooklm', 'skipped', { reason: 'kb-sync-managed' });
      categoryResults.push({ category: catName, status: 'skipped', reason: 'kb-sync-managed' });
      continue;
    }

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
      const packTitle = `${catDef.title} Pack`;
      let result = { ok: false };
      let attempt = 0;
      while (attempt < maxRetries) {
        attempt++;
        logInfo(`  Uploading pack to NotebookLM (Attempt ${attempt}/${maxRetries})...`);
        result = syncPackToNotebook({
          targetUuid, packFile, packTitle, categoryTitle: catDef.title, deps,
          log: { info: (m) => logInfo(`  ${m}`), warn: (m) => logWarn(`  ${m}`) },
        });
        if (result.ok || result.reason === 'prune_failed') break;
        logWarn(`  Sync attempt ${attempt} failed: ${result.reason}${result.error ? ` (${result.error})` : ''}`);
        if (attempt < maxRetries) {
          logInfo(`  Waiting ${backoffMs}ms before retry...`);
          sleep(backoffMs);
        }
      }

      if (result.ok) {
        logInfo(`  ✓ Successfully uploaded pack to NotebookLM: ${catDef.title}`);
        emitTelemetryEvent(runId, dateStr, catName, 'sync-notebooklm', 'success', { attempt, pruned: result.pruned });
        categoryResults.push({ category: catName, status: 'synced', attempts: attempt, durationMs: Date.now() - catStartTime });
      } else {
        logError(`  ✗ Failed to sync ${catName}: ${result.reason}`);
        emitTelemetryEvent(runId, dateStr, catName, 'sync-notebooklm', 'failed', { max_attempts: maxRetries, reason: result.reason });
        categoryResults.push({ category: catName, status: 'failed_upload', reason: result.reason });
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
    appendToWikiLog(ROOT_DIR, mdSummary);
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
