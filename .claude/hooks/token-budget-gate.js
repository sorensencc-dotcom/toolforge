#!/usr/bin/env node
/**
 * Token Budget Gate Hook
 *
 * Blocks Edit/Bash until /plan mode if session exceeds LOC + commit thresholds.
 * Prevents token overruns by forcing planning before large code phases.
 *
 * Thresholds (configurable via env):
 *   - LOC_THRESHOLD: 50000 (cumulative edits this session)
 *   - COMMIT_THRESHOLD: 200 (commits in working branch)
 *   - Force /plan after exceeding both
 *
 * Exit: 0 = proceed, 1 = blocked (need plan)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const LOC_THRESHOLD = parseInt(process.env.LOC_THRESHOLD || '50000');
const COMMIT_THRESHOLD = parseInt(process.env.COMMIT_THRESHOLD || '200');
const PLAN_MARKER = '.ijfw/plan-locked.json';

function getSessionLOC() {
  try {
    const editsLog = '.ijfw/.session-edits.jsonl';
    if (!fs.existsSync(editsLog)) return 0;

    let total = 0;
    const lines = fs.readFileSync(editsLog, 'utf8').split('\n').filter(Boolean);

    lines.forEach(line => {
      try {
        const edit = JSON.parse(line);
        if (edit.added) total += edit.added;
        if (edit.removed) total += edit.removed;
      } catch (e) { /* skip malformed */ }
    });

    return total;
  } catch (e) {
    return 0;
  }
}

function getBranchCommits() {
  try {
    const output = execSync(
      'git rev-list --count HEAD ^origin/main 2>/dev/null || echo "0"',
      { encoding: 'utf8' }
    ).trim();
    return parseInt(output) || 0;
  } catch (e) {
    return 0;
  }
}

function isPlanLocked() {
  return fs.existsSync(PLAN_MARKER);
}

function log(msg, level = 'INFO') {
  const ts = new Date().toISOString().slice(11, 19);
  console.error(`[${ts}] [token-budget-gate] [${level}] ${msg}`);
}

// Main check
const sessionLOC = getSessionLOC();
const branchCommits = getBranchCommits();
const planLocked = isPlanLocked();

log(`Session LOC: ${sessionLOC} (threshold: ${LOC_THRESHOLD})`);
log(`Branch commits: ${branchCommits} (threshold: ${COMMIT_THRESHOLD})`);
log(`Plan locked: ${planLocked}`);

const locExceeded = sessionLOC > LOC_THRESHOLD;
const commitsExceeded = branchCommits > COMMIT_THRESHOLD;
const thresholdsHit = locExceeded || commitsExceeded;

if (thresholdsHit && !planLocked) {
  log('BLOCKED: Session scale high + no plan locked', 'BLOCK');
  log('Fix: Enter /plan mode to lock phase strategy', 'ACTION');
  log('  - Reduces token waste by forcing early design decisions', 'ACTION');
  log('  - Creates checkpoint if session needs to resume later', 'ACTION');
  log('', 'ACTION');
  log('Or: Set LOC_THRESHOLD=999999 COMMIT_THRESHOLD=999999 to skip', 'BYPASS');
  process.exit(1);
}

if (thresholdsHit && planLocked) {
  log('Plan locked. Proceeding under budget gate.', 'PASS');
  process.exit(0);
}

log('Session within thresholds. Proceeding.', 'PASS');
process.exit(0);
