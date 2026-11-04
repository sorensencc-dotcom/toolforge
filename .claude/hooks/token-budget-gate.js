#!/usr/bin/env node
/**
 * Token Budget Gate Hook
 *
 * Blocks Edit/Bash until /plan mode if the branch exceeds the commit or edit-size threshold.
 * Prevents token overruns by forcing planning before large code phases.
 *
 * Thresholds (configurable via env):
 *   - COMMIT_THRESHOLD: 200 (commits in working branch)
 *   - TOKEN_BUDGET_MAX_LINES: 1500 (added+deleted lines vs merge-base with main,
 *     including uncommitted working-tree changes)
 *   - Fails open (no block) if git is unavailable
 *   - Plan lock: set PLAN_LOCKED=1 once a plan is in place
 *
 * Exit: 0 = proceed, 1 = blocked (need plan)
 */

import { execFileSync } from 'child_process';

const COMMIT_THRESHOLD = parseInt(process.env.COMMIT_THRESHOLD || '200');
const MAX_LINES = parseInt(process.env.TOKEN_BUDGET_MAX_LINES || '1500');

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

// Added+deleted lines on this branch vs merge-base with main, including
// uncommitted working-tree changes. Returns null if git can't answer.
function getBranchEditLines() {
  let base = null;
  for (const ref of ['origin/main', 'main']) {
    try { base = git(['merge-base', 'HEAD', ref]); break; } catch (e) { /* try next */ }
  }
  if (!base) return null;
  try {
    let total = 0;
    for (const line of git(['diff', '--numstat', base]).split('\n')) {
      const [added, deleted] = line.split('\t');
      // Binary files report '-'; they don't count toward the line budget.
      total += (parseInt(added, 10) || 0) + (parseInt(deleted, 10) || 0);
    }
    return total;
  } catch (e) {
    return null;
  }
}

function getBranchCommits() {
  try {
    // execFileSync so cmd.exe cannot eat ^ as its escape character.
    const output = execFileSync(
      'git',
      ['rev-list', '--count', 'HEAD', '^origin/main'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    ).trim();
    return parseInt(output, 10) || 0;
  } catch (e) {
    return 0;
  }
}

function isPlanLocked() {
  return process.env.PLAN_LOCKED === '1';
}

function log(msg, level = 'INFO') {
  const ts = new Date().toISOString().slice(11, 19);
  console.error(`[${ts}] [token-budget-gate] [${level}] ${msg}`);
}

// Main check
const branchCommits = getBranchCommits();
const editLines = getBranchEditLines();
const planLocked = isPlanLocked();

log(`Branch commits: ${branchCommits} (threshold: ${COMMIT_THRESHOLD})`);
if (editLines === null) {
  log('git diff unavailable; skipping edit-size check (fail open)', 'WARN');
} else {
  log(`Branch edit lines: ${editLines} (threshold: ${MAX_LINES})`);
}
log(`Plan locked: ${planLocked}`);

const commitsExceeded = branchCommits > COMMIT_THRESHOLD;
const linesExceeded = editLines !== null && editLines > MAX_LINES;
const thresholdsHit = commitsExceeded || linesExceeded;

if (thresholdsHit && !planLocked) {
  log('BLOCKED: Session scale high + no plan locked', 'BLOCK');
  log('Fix: Enter /plan mode to lock phase strategy', 'ACTION');
  log('  - Reduces token waste by forcing early design decisions', 'ACTION');
  log('  - Creates checkpoint if session needs to resume later', 'ACTION');
  log('', 'ACTION');
  log('Or: Set PLAN_LOCKED=1 or raise COMMIT_THRESHOLD / TOKEN_BUDGET_MAX_LINES to skip', 'BYPASS');
  // Grok fail-opens on exit 1. Deny with JSON, then exit 0.
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason:
          'Session scale high and no plan locked. Enter /plan mode, or set PLAN_LOCKED=1 or raise COMMIT_THRESHOLD / TOKEN_BUDGET_MAX_LINES to skip.',
      },
    })
  );
  process.exit(0);
}

if (thresholdsHit && planLocked) {
  log('Plan locked. Proceeding under budget gate.', 'PASS');
  process.exit(0);
}

log('Session within thresholds. Proceeding.', 'PASS');
process.exit(0);
