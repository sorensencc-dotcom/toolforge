#!/usr/bin/env node

/**
 * trm-stage-pr.mjs
 *
 * PR Triage bridge: Prepares and stages git branches, test scaffolds,
 * and PR draft metadata for promoted TRM coding action cards.
 *
 * Usage:
 *   node scripts/trm-stage-pr.mjs --card-id=<cardId> [--create-branch] [--dry-run]
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DEV_ROOT = path.resolve(__dirname, '..');

export const REPO_LOCAL_PATHS = {
  'toolforge': DEV_ROOT,
  'icf': path.resolve(DEV_ROOT, 'icf'),
  'kb-sync': path.resolve(DEV_ROOT, 'kb-sync'),
  'sigil': path.resolve(DEV_ROOT, 'sigil-repo'),
  'rewrite-mcp': path.resolve(DEV_ROOT, 'rewrite-mcp'),
  'rewrite': path.resolve(DEV_ROOT, 'rewrite-mcp'),
  'rewrite-docs': path.resolve(DEV_ROOT, 'rewrite-docs'),
  'ironledger': path.resolve(DEV_ROOT, 'IronLedger'),
  'IronLedger': path.resolve(DEV_ROOT, 'IronLedger'),
  'personal-os': path.resolve(DEV_ROOT, 'personal-os')
};

export function resolveLocalRepoDir(target) {
  if (!target) return null;
  const key = String(target).trim().toLowerCase();
  const cleanKey = key.includes('/') ? key.split('/').pop().trim() : key;
  for (const [k, v] of Object.entries(REPO_LOCAL_PATHS)) {
    if (k.toLowerCase() === cleanKey) {
      if (fs.existsSync(v)) return v;
    }
  }
  return null;
}

export function loadCardData(cardId, options = {}) {
  const customDirs = options.inboxDir ? [options.inboxDir, path.resolve(options.inboxDir, 'completed')] : [];
  const searchDirs = [
    ...customDirs,
    path.resolve(DEV_ROOT, '.harness/tasks/pending'),
    path.resolve(DEV_ROOT, '.harness/tasks/in-progress'),
    path.resolve(DEV_ROOT, '.harness/tasks/completed'),
    path.resolve(DEV_ROOT, '.harness/tasks/archive'),
    path.resolve(DEV_ROOT, 'trm-drive/inbox/completed')
  ];

  for (const dir of searchDirs) {
    if (!fs.existsSync(dir)) continue;
    try {
      const files = fs.readdirSync(dir);
      for (const f of files) {
        if (f.includes(cardId)) {
          const fullPath = path.join(dir, f);
          const raw = fs.readFileSync(fullPath, 'utf8');
          if (f.endsWith('.json') || raw.trim().startsWith('{')) {
            const data = JSON.parse(raw);
            data._filePath = fullPath;
            return data;
          }
          if (f.endsWith('.md') || raw.includes('---')) {
            const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
            const frontmatter = {};
            if (match) {
              for (const line of match[1].split(/\r?\n/)) {
                const idx = line.indexOf(':');
                if (idx > 0) frontmatter[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
              }
              frontmatter.body = raw.slice(match[0].length).trim();
            }
            frontmatter._filePath = fullPath;
            return frontmatter;
          }
        }
      }
    } catch {}
  }

  // Fallback to ledger
  const ledgerPath = options.ledgerPath || (options.inboxDir ? path.resolve(options.inboxDir, 'ledger.jsonl') : path.resolve(DEV_ROOT, 'trm-drive/inbox/ledger.jsonl'));
  if (fs.existsSync(ledgerPath)) {
    const lines = fs.readFileSync(ledgerPath, 'utf8').split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const row = JSON.parse(line);
        if (row.id === cardId || row.action_id === cardId) {
          return row;
        }
      } catch {}
    }
  }

  return null;
}

export function generateTestScaffold(card) {
  const cardId = card.id || card.action_id || 'unknown';
  const rawTitle = card.title || card.intent || cardId;
  const title = String(rawTitle).replace(/[\r\n]+/g, ' ').replace(/'/g, "\\'").trim();
  const target = card.target || card.domain || 'core';
  const deliverables = card.deliverables || [];
  const acceptanceList = Array.isArray(deliverables) && deliverables.length > 0
    ? deliverables.map(d => ` * - ${d}`).join('\n')
    : ' * - Implements requirements according to specifications\n * - Tests pass with zero regressions';

  const isPython = target.toLowerCase() === 'ironledger';

  if (isPython) {
    return `"""
TRM TDD Test Contract: ${cardId}
Intent: ${title}
Target: ${target}

Acceptance Criteria:
${acceptanceList}
"""
import pytest

def test_${cardId.replace(/[^a-zA-Z0-9_]/g, '_')}_contract():
    # Contract scaffold for TRM implementation
    # Coding agent must implement unit verification and assert truth
    assert True
`;
  }

  return `/**
 * TRM TDD Test Contract: ${cardId}
 * Intent: ${title}
 * Target: ${target}
 *
 * Acceptance Criteria:
${acceptanceList}
 */

import test from 'node:test';
import assert from 'node:assert/strict';

test('TRM Contract: ${cardId} - ${title.replace(/'/g, "\\'")}', async () => {
  // Test contract scaffold authored during TRM PR staging
  // Coding agent must implement unit verification and assert truth
  assert.ok(true, 'Test harness initial scaffold active');
});
`;
}

export function stagePr(cardId, options = {}) {
  const dryRun = Boolean(options.dryRun);
  const createBranch = Boolean(options.createBranch);
  const card = loadCardData(cardId, options);

  if (!card) {
    throw new Error(`Card ${cardId} not found in pending, completed, or ledger`);
  }

  const target = card.target || card.domain || 'core';
  const repoDir = resolveLocalRepoDir(target);
  if (!repoDir) {
    throw new Error(`UNRESOLVED_LOCAL_REPO: Cannot stage PR for target '${target}'. No valid local repository directory resolved.`);
  }
  const branchName = `trm/${cardId}`;
  const isPython = target.toLowerCase() === 'ironledger';

  const testDir = isPython ? path.join(repoDir, 'tests') : path.join(repoDir, 'tests');
  const testFileName = isPython ? `test_trm_${cardId.replace(/[^a-zA-Z0-9_]/g, '_')}.py` : `trm-${cardId}.test.mjs`;
  const testFilePath = path.join(testDir, testFileName);

  const testContent = generateTestScaffold(card);

  console.log(`[stage-pr] Staging PR bridge for ${cardId}`);
  console.log(`[stage-pr] Target Repo Dir: ${repoDir}`);
  console.log(`[stage-pr] Staged Branch: ${branchName}`);
  console.log(`[stage-pr] Test Scaffold: ${testFilePath}`);

  if (!dryRun) {
    if (createBranch && fs.existsSync(path.join(repoDir, '.git'))) {
      try {
        console.log(`[stage-pr] Creating git branch ${branchName} in ${repoDir}...`);
        execFileSync('git', ['branch', branchName], { cwd: repoDir, stdio: 'pipe' });
      } catch (err) {
        // If branch exists, ignore error
        console.log(`[stage-pr] Branch notice: ${err.message}`);
      }
    }

    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    if (!fs.existsSync(testFilePath)) {
      fs.writeFileSync(testFilePath, testContent, 'utf8');
      console.log(`[stage-pr] Wrote test scaffold to ${testFilePath}`);
    } else {
      console.log(`[stage-pr] Test scaffold already exists at ${testFilePath}`);
    }

    // Update ledger row with PR staging metadata
    const ledgerPath = options.ledgerPath || (options.inboxDir ? path.resolve(options.inboxDir, 'ledger.jsonl') : path.resolve(DEV_ROOT, 'trm-drive/inbox/ledger.jsonl'));
    if (fs.existsSync(ledgerPath)) {
      const lines = fs.readFileSync(ledgerPath, 'utf8').split('\n').filter(Boolean);
      let found = false;
      const updated = lines.map(line => {
        try {
          const row = JSON.parse(line);
          if (row.id === cardId || row.action_id === cardId) {
            found = true;
            return JSON.stringify({
              ...row,
              pr_branch: branchName,
              pr_stage: 'STAGED_FOR_DEV',
              pr_staged_at: new Date().toISOString(),
              test_scaffold: path.relative(repoDir, testFilePath).replace(/\\/g, '/')
            });
          }
          return line;
        } catch {
          return line;
        }
      });
      if (found) {
        fs.writeFileSync(ledgerPath, updated.join('\n') + '\n', 'utf8');
        console.log(`[stage-pr] Updated ledger with pr_branch=${branchName}`);
      }
    }
  }

  return {
    cardId,
    target,
    repoDir,
    branchName,
    testFilePath,
    dryRun
  };
}

async function main() {
  const args = process.argv.slice(2);
  let cardId = null;
  let createBranch = false;
  let dryRun = false;

  for (const arg of args) {
    if (arg.startsWith('--card-id=')) cardId = arg.slice('--card-id='.length);
    else if (arg.startsWith('--card=')) cardId = arg.slice('--card='.length);
    else if (arg === '--create-branch') createBranch = true;
    else if (arg === '--dry-run') dryRun = true;
  }

  if (!cardId) {
    console.error('Usage: node scripts/trm-stage-pr.mjs --card-id=<cardId> [--create-branch] [--dry-run]');
    process.exit(1);
  }

  try {
    const res = stagePr(cardId, { createBranch, dryRun });
    console.log('[stage-pr] PR stage successful:', JSON.stringify(res, null, 2));
  } catch (err) {
    console.error('[stage-pr] Error staging PR:', err.message);
    process.exit(1);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
