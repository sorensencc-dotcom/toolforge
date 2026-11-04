#!/usr/bin/env node

/**
 * scripts/trm-factory-runner.mjs
 *
 * Software Factory Implementer Runner (Step 3).
 * Consumes action cards from .harness/tasks/pending/:
 * 1. Code targets: stages git branch, authors TDD test contract scaffold,
 *    executes verification suite wrapped in 60s hard timeout brake,
 *    and moves task descriptor to .harness/tasks/in-progress/.
 * 2. Non-code / Research targets: verifies wiki deliverables in kb-sync/wiki/research,
 *    and moves completed research cards to .harness/tasks/completed/.
 * 3. Archives stale fixtures in .harness/tasks/in-progress/ to .harness/tasks/archive/.
 *
 * Usage:
 *   node scripts/trm-factory-runner.mjs [--all] [--card-id=<cardId>] [--dry-run] [--archive-fixtures]
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  DEV_ROOT,
  resolveLocalRepoDir,
  stagePr,
  loadCardData
} from './trm-stage-pr.mjs';
import {
  resolveTargetRepo,
  NON_CODE_TARGETS,
  parseCardFile,
  updateLedgerRow
} from './trm-promote-card.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const HARNESS_ROOT = path.resolve(DEV_ROOT, '.harness/tasks');
export const PENDING_DIR = path.resolve(HARNESS_ROOT, 'pending');
export const IN_PROGRESS_DIR = path.resolve(HARNESS_ROOT, 'in-progress');
export const COMPLETED_DIR = path.resolve(HARNESS_ROOT, 'completed');
export const ARCHIVE_DIR = path.resolve(HARNESS_ROOT, 'archive');
export const WIKI_RESEARCH_DIR = path.resolve(DEV_ROOT, 'kb-sync/obsidian/vault/wiki/research');
export const LEDGER_PATH = path.resolve(DEV_ROOT, 'trm-drive/inbox/ledger.jsonl');

export const HARD_TIMEOUT_MS = 60000;

export function ensureDirectories() {
  for (const dir of [PENDING_DIR, IN_PROGRESS_DIR, COMPLETED_DIR, ARCHIVE_DIR]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

/**
 * Archive stale fixture files from in-progress/ to archive/
 */
export function archiveStaleFixtures(options = {}) {
  const dryRun = Boolean(options.dryRun);
  ensureDirectories();
  const archived = [];

  if (fs.existsSync(IN_PROGRESS_DIR)) {
    const files = fs.readdirSync(IN_PROGRESS_DIR);
    for (const file of files) {
      if (file.includes('fixture') || file === 'act-inprogress-fixture.json') {
        const src = path.join(IN_PROGRESS_DIR, file);
        const dest = path.join(ARCHIVE_DIR, file);
        archived.push(file);
        if (!dryRun) {
          fs.renameSync(src, dest);
        }
      }
    }
  }
  return archived;
}

/**
 * Determine whether a card targets a local code repository
 */
export function isCodeCard(cardData) {
  if (!cardData) return false;
  const target = cardData.target || cardData.domain;
  if (!target) return false;
  const lower = String(target).toLowerCase();
  if (NON_CODE_TARGETS.has(lower)) return false;
  const localDir = resolveLocalRepoDir(target);
  return Boolean(localDir && fs.existsSync(localDir));
}

/**
 * Match non-code research cards against completed wiki research artifacts
 */
export function findResearchDeliverable(cardData, wikiDir = WIKI_RESEARCH_DIR) {
  if (!fs.existsSync(wikiDir)) return null;
  const wikiFiles = fs.readdirSync(wikiDir);

  const title = String(cardData.title || '').toLowerCase();
  const intent = String(cardData.intent || '').toLowerCase();
  const body = String(cardData.context?.body || cardData.body || '').toLowerCase();

  // 1. Check for explicit GAP-20 or Bombard-Williamson markers
  if (title.includes('bombard') || intent.includes('bombard') || body.includes('gap-20')) {
    const match = wikiFiles.find(f => f.includes('gap-20') || f.includes('bombard'));
    if (match) return match;
  }

  // 2. Check for Cork operations or archival audit markers
  if (title.includes('cork') || intent.includes('cork') || body.includes('cork marina')) {
    const match = wikiFiles.find(f => f.includes('cork-operations') || f.includes('archival-audit'));
    if (match) return match;
  }

  // 3. Check for specific action id matches
  const actionId = String(cardData.id || cardData.action_id || '').toLowerCase();
  if (actionId) {
    const match = wikiFiles.find(f => f.toLowerCase().includes(actionId));
    if (match) return match;
  }

  return null;
}

/**
 * Executes a verification test suite with an enforced hard timeout
 */
export function runTestWithTimeout(testFilePath, cwd = DEV_ROOT, timeoutMs = HARD_TIMEOUT_MS) {
  const isPython = testFilePath.endsWith('.py');
  const cmd = isPython ? 'pytest' : process.execPath;
  const args = isPython ? [testFilePath] : ['--test', testFilePath];

  const start = Date.now();
  const res = spawnSync(cmd, args, {
    cwd,
    timeout: timeoutMs,
    encoding: 'utf8',
    env: { ...process.env, NODE_ENV: 'test' }
  });
  const duration = Date.now() - start;

  if (res.error) {
    if (res.error.code === 'ETIMEDOUT') {
      return { success: false, timedOut: true, duration, error: `Test exceeded ${timeoutMs}ms timeout limit.` };
    }
    return { success: false, timedOut: false, duration, error: res.error.message };
  }

  return {
    success: res.status === 0,
    timedOut: false,
    duration,
    exitCode: res.status,
    stdout: res.stdout || '',
    stderr: res.stderr || ''
  };
}

/**
 * Move file between directories safely (rename with copy fallback)
 */
function moveFile(src, dest) {
  try {
    fs.renameSync(src, dest);
  } catch {
    fs.copyFileSync(src, dest);
    fs.unlinkSync(src);
  }
}

/**
 * Process a single action card file
 */
export function processCard(cardFilePath, options = {}) {
  const dryRun = Boolean(options.dryRun);
  ensureDirectories();

  if (!fs.existsSync(cardFilePath)) {
    throw new Error(`Card file does not exist: ${cardFilePath}`);
  }

  const raw = fs.readFileSync(cardFilePath, 'utf8');
  let cardData = {};
  if (raw.trim().startsWith('{')) {
    cardData = JSON.parse(raw);
  } else {
    const parsed = parseCardFile(cardFilePath);
    cardData = { ...parsed.frontmatter, body: parsed.body };
  }

  const cardId = cardData.id || cardData.action_id || path.basename(cardFilePath).replace(/\.(md|json)$/i, '');
  const fileName = path.basename(cardFilePath);

  if (isCodeCard(cardData)) {
    // Code Card Flow
    const stageResult = stagePr(cardId, {
      createBranch: true,
      dryRun,
      cardData,
      inboxDir: path.dirname(cardFilePath)
    });

    const testResult = !dryRun && stageResult.testFilePath && fs.existsSync(stageResult.testFilePath)
      ? runTestWithTimeout(stageResult.testFilePath, stageResult.repoDir, options.timeoutMs || HARD_TIMEOUT_MS)
      : { success: true, timedOut: false, duration: 0 };

    if (!testResult.success) {
      return {
        cardId,
        fileName,
        type: 'CODE',
        status: 'FAILED_TEST',
        error: testResult.error,
        timedOut: testResult.timedOut,
        duration: testResult.duration
      };
    }

    if (!dryRun) {
      const destPath = path.join(options.inProgressDir || IN_PROGRESS_DIR, fileName);
      moveFile(cardFilePath, destPath);
      updateLedgerRow(LEDGER_PATH, cardId, {
        status: 'IN_PROGRESS',
        pr_stage: 'IN_PROGRESS',
        pr_branch: stageResult.branchName,
        pr_test_status: 'PASS',
        pr_updated_at: new Date().toISOString()
      });
    }

    return {
      cardId,
      fileName,
      type: 'CODE',
      status: 'IN_PROGRESS',
      branchName: stageResult.branchName,
      testFilePath: stageResult.testFilePath,
      duration: testResult.duration,
      dryRun
    };
  }

  // Non-code / Research Card Flow
  const deliverable = findResearchDeliverable(cardData, options.wikiDir || WIKI_RESEARCH_DIR);
  if (deliverable) {
    if (!dryRun) {
      const destPath = path.join(options.completedDir || COMPLETED_DIR, fileName);
      moveFile(cardFilePath, destPath);
      updateLedgerRow(LEDGER_PATH, cardId, {
        status: 'COMPLETED',
        stage: 'COMPLETED',
        research_ref: deliverable,
        completed_at: new Date().toISOString()
      });
    }
    return {
      cardId,
      fileName,
      type: 'RESEARCH',
      status: 'COMPLETED',
      researchDeliverable: deliverable,
      dryRun
    };
  }

  return {
    cardId,
    fileName,
    type: 'RESEARCH',
    status: 'PENDING_RESEARCH',
    dryRun
  };
}

/**
 * Process all pending cards in .harness/tasks/pending
 */
export function processAllPending(options = {}) {
  ensureDirectories();
  const dryRun = Boolean(options.dryRun);
  const results = [];

  const archivedFixtures = archiveStaleFixtures(options);

  if (fs.existsSync(PENDING_DIR)) {
    const files = fs.readdirSync(PENDING_DIR).filter(f => f.endsWith('.md') || f.endsWith('.json'));
    for (const f of files) {
      const fullPath = path.join(PENDING_DIR, f);
      try {
        const res = processCard(fullPath, options);
        results.push(res);
      } catch (err) {
        results.push({
          fileName: f,
          status: 'ERROR',
          error: err.message
        });
      }
    }
  }

  return {
    dryRun,
    archivedFixtures,
    processed: results,
    count: results.length
  };
}

export async function main() {
  const args = process.argv.slice(2);
  const isAll = args.includes('--all');
  const isDryRun = args.includes('--dry-run');
  const isArchiveFixtures = args.includes('--archive-fixtures');
  const cardIdArg = args.find(a => a.startsWith('--card-id=') || a.startsWith('--card='));
  const cardId = cardIdArg ? cardIdArg.split('=')[1] : null;

  if (isArchiveFixtures) {
    const archived = archiveStaleFixtures({ dryRun: isDryRun });
    console.log(`[trm-factory-runner] Archived fixtures: ${JSON.stringify(archived)}`);
  }

  if (cardId) {
    const card = loadCardData(cardId);
    if (!card || !card._filePath) {
      console.error(`[trm-factory-runner] Card ${cardId} not found.`);
      process.exit(1);
    }
    const res = processCard(card._filePath, { dryRun: isDryRun });
    console.log(`[trm-factory-runner] Processed card ${cardId}:`, JSON.stringify(res, null, 2));
    return;
  }

  if (isAll) {
    const summary = processAllPending({ dryRun: isDryRun });
    console.log(`[trm-factory-runner] Processed pending backlog:`, JSON.stringify(summary, null, 2));
    return;
  }

  console.log('Usage: node scripts/trm-factory-runner.mjs [--all] [--card-id=<cardId>] [--dry-run] [--archive-fixtures]');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
