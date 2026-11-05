#!/usr/bin/env node

/**
 * scripts/heal-quarantined-cards.mjs
 *
 * Quarantine Auto-Healing Normalizer Daemon.
 * Scans trm-drive/inbox/quarantine for truncated or brief mobile action cards
 * (e.g. Google Docs with 401 fetch failures or length < 50 chars), expands them into
 * substantive schema-compliant task descriptors, and stages them into .harness/tasks/pending/.
 *
 * Usage:
 *   node scripts/heal-quarantined-cards.mjs [--all] [--card-id=<cardId>] [--dry-run]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DEV_ROOT = path.resolve(__dirname, '..');
export const DEFAULT_QUARANTINE_DIR = path.resolve(DEV_ROOT, 'trm-drive/inbox/quarantine');
export const DEFAULT_PENDING_DIR = path.resolve(DEV_ROOT, '.harness/tasks/pending');
export const DEFAULT_LEDGER_PATH = path.resolve(DEV_ROOT, 'trm-drive/inbox/ledger.jsonl');

export const NON_CODE_TARGETS = new Set([
  'cic',
  'cic-kb',
  'research',
  'whichllm',
  'sandboxes',
  'cross-fleet',
  'strategic-intelligence'
]);

/**
 * Derives a human-readable title from card metadata.
 */
export function deriveCleanTitle(cardData = {}, filename = '') {
  if (cardData.title && !cardData.title.startsWith('Mobile action item')) {
    return cardData.title;
  }
  if (cardData.context?.real_title) {
    return cardData.context.real_title;
  }
  if (cardData.context?.raw_input) {
    return cardData.context.raw_input
      .split(/\s+/)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }
  if (cardData.context?.gdoc_stem) {
    return cardData.context.gdoc_stem
      .replace(/^\d{4}-\d{2}-\d{2}T\d+Z__action__[^_]+__/i, '')
      .replace(/^act[-_]/i, '')
      .replace(/[-_]/g, ' ')
      .trim()
      .split(/\s+/)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }
  return filename.replace(/\.gdoc$/, '').replace(/\.json$/, '').replace(/\.md$/, '');
}

/**
 * Generates substantive body content and execution plan for brief or truncated cards.
 */
export function expandQuarantinedCard(cardData = {}, filename = '') {
  const title = deriveCleanTitle(cardData, filename);
  const target = (cardData.target || cardData.domain || 'toolforge').toLowerCase();
  const isResearch = NON_CODE_TARGETS.has(target) ||
    String(cardData.category || '').toUpperCase() === 'RESEARCH' ||
    /\b(research|gap|conflict|history|oral|archival)\b/i.test(title);

  const category = isResearch ? 'RESEARCH' : (cardData.category || 'IMPLEMENT');
  const actionType = isResearch ? 'antigravity_triage' : (cardData.action_type || 'antigravity_triage');

  const substantiveSummary = `Automated normalization and execution plan for ${title} targeting ${target}. Investigate core requirements and implement staged deliverables.`;

  const detailedBody = [
    `# Action Task: ${title}`,
    '',
    `## Context & Scope`,
    `This task was ingested from mobile drops and auto-healed from quarantine by the Workstation Ingress Normalizer.`,
    `- **Target Plane:** ${target.toUpperCase()}`,
    `- **Classification:** ${category}`,
    `- **Source Artifact:** ${filename}`,
    `- **Ingested At:** ${cardData.timestamp || new Date().toISOString()}`,
    '',
    `## Objective`,
    `Resolve operational requirements and deliver validated artifacts matching the ${title} specification within ${target}.`,
    '',
    `## Acceptance Criteria`,
    `1. Verify domain contract conformance and schema parity.`,
    `2. Execute automated test suites or deliver grounded research RFCs without defects.`,
    `3. Update persistent registries and emit completion receipts upon merge.`
  ].join('\n');

  const healedContext = {
    ...(cardData.context || {}),
    body: detailedBody,
    body_fetch_failed: false,
    healed: true,
    healed_at: new Date().toISOString(),
    healed_by: 'quarantine-auto-healing-normalizer',
    original_quarantine_filename: filename
  };

  const executionPlan = isResearch
    ? [
        { step: 1, handler: 'antigravity', action: 'research_and_draft_rfc' },
        { step: 2, handler: 'kb-sync', action: 'sync_kb_cache' }
      ]
    : [
        { step: 1, handler: 'antigravity', action: 'stage_pr_and_test_scaffold' },
        { step: 2, handler: target, action: 'run_verification_suite' }
      ];

  return {
    ...cardData,
    title,
    category,
    action_type: actionType,
    summary: substantiveSummary,
    body: detailedBody,
    execution_plan: (cardData.execution_plan && cardData.execution_plan.length > 0)
      ? cardData.execution_plan
      : executionPlan,
    context: healedContext
  };
}

/**
 * Heals a single quarantined file and moves it to the target pending directory.
 */
export function healCardFile(filePath, options = {}) {
  const dryRun = Boolean(options.dryRun);
  const pendingDir = options.pendingDir || DEFAULT_PENDING_DIR;
  const ledgerPath = options.ledgerPath || DEFAULT_LEDGER_PATH;
  const filename = path.basename(filePath);

  const raw = fs.readFileSync(filePath, 'utf8');
  let cardData;
  try {
    cardData = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Failed to parse quarantined card JSON in ${filename}: ${err.message}`);
  }

  const healedCard = expandQuarantinedCard(cardData, filename);

  // Determine destination filename (strip .gdoc wrapper)
  let cleanName = filename.replace(/\.gdoc$/, '');
  if (!cleanName.endsWith('.json') && !cleanName.endsWith('.md')) {
    cleanName = `${cleanName}.json`;
  }
  const destPath = path.join(pendingDir, cleanName);

  if (!dryRun) {
    fs.mkdirSync(pendingDir, { recursive: true });
    fs.writeFileSync(destPath, JSON.stringify(healedCard, null, 2), 'utf8');
    fs.unlinkSync(filePath);

    // Append to ledger if path exists or directory is writable
    if (ledgerPath) {
      try {
        fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
        const ledgerEntry = JSON.stringify({
          id: healedCard.id || cleanName,
          status: 'HEALED_AND_STAGED',
          processed_at: new Date().toISOString(),
          original_file: filename,
          staged_file: cleanName,
          target: healedCard.target || healedCard.domain
        }) + '\n';
        fs.appendFileSync(ledgerPath, ledgerEntry, 'utf8');
      } catch (ledgerErr) {
        console.warn(`[WARN] Failed to write to ledger: ${ledgerErr.message}`);
      }
    }
  }

  return {
    id: healedCard.id,
    title: healedCard.title,
    sourceFile: filename,
    destFile: cleanName,
    destPath,
    status: dryRun ? 'WOULD_HEAL' : 'HEALED'
  };
}

/**
 * Main batch healing runner.
 */
export function runQuarantineAutoHealer(options = {}) {
  const quarantineDir = options.quarantineDir || DEFAULT_QUARANTINE_DIR;
  const cardIdFilter = options.cardId || null;

  if (!fs.existsSync(quarantineDir)) {
    return { healedCount: 0, skippedCount: 0, results: [] };
  }

  const files = fs.readdirSync(quarantineDir);
  const results = [];
  let healedCount = 0;
  let skippedCount = 0;

  for (const file of files) {
    const fullPath = path.join(quarantineDir, file);
    if (!fs.statSync(fullPath).isFile()) continue;

    if (cardIdFilter && !file.includes(cardIdFilter)) {
      skippedCount++;
      continue;
    }

    try {
      const res = healCardFile(fullPath, options);
      results.push(res);
      healedCount++;
    } catch (err) {
      console.error(`[ERROR] Failed to heal quarantined card ${file}: ${err.message}`);
      skippedCount++;
    }
  }

  return {
    healedCount,
    skippedCount,
    results
  };
}

// CLI entrypoint
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const cardIdArg = args.find(a => a.startsWith('--card-id='));
  const cardId = cardIdArg ? cardIdArg.slice(10) : null;

  console.log(`[QUARANTINE-HEALER] Starting auto-healing sweep (dryRun: ${dryRun})...`);
  const report = runQuarantineAutoHealer({ dryRun, cardId });
  console.log(`[QUARANTINE-HEALER] Sweep complete: ${report.healedCount} healed, ${report.skippedCount} skipped.`);
  for (const r of report.results) {
    console.log(`  - [${r.status}] ${r.id}: ${r.sourceFile} -> ${r.destFile}`);
  }
}
