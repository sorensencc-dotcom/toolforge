#!/usr/bin/env node
/**
 * Token Budget Gate Hook
 *
 * Blocks Edit/Bash until /plan mode if session exceeds the branch commit threshold.
 * Prevents token overruns by forcing planning before large code phases.
 *
 * Thresholds (configurable via env):
 *   - COMMIT_THRESHOLD: 200 (commits in working branch)
 *   - Plan lock: set PLAN_LOCKED=1 once a plan is in place
 *
 * Exit: 0 = proceed, 1 = blocked (need plan)
 */

import { execFileSync } from 'child_process';

const COMMIT_THRESHOLD = parseInt(process.env.COMMIT_THRESHOLD || '200');

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
const planLocked = isPlanLocked();

log(`Branch commits: ${branchCommits} (threshold: ${COMMIT_THRESHOLD})`);
log(`Plan locked: ${planLocked}`);

const commitsExceeded = branchCommits > COMMIT_THRESHOLD;
const thresholdsHit = commitsExceeded;

if (thresholdsHit && !planLocked) {
  log('BLOCKED: Session scale high + no plan locked', 'BLOCK');
  log('Fix: Enter /plan mode to lock phase strategy', 'ACTION');
  log('  - Reduces token waste by forcing early design decisions', 'ACTION');
  log('  - Creates checkpoint if session needs to resume later', 'ACTION');
  log('', 'ACTION');
  log('Or: Set PLAN_LOCKED=1 or COMMIT_THRESHOLD=999999 to skip', 'BYPASS');
  // Grok fail-opens on exit 1. Deny with JSON, then exit 0.
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason:
          'Session scale high and no plan locked. Enter /plan mode, or set PLAN_LOCKED=1 or COMMIT_THRESHOLD=999999 to skip.',
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
