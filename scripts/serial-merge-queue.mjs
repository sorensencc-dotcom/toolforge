import { execFileSync, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

const COLOR = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

const logInfo = (msg) => console.log(`${COLOR.green}[MergeQueue] [INFO]${COLOR.reset} ${msg}`);
const logWarn = (msg) => console.log(`${COLOR.yellow}[MergeQueue] [WARN]${COLOR.reset} ${msg}`);
const logError = (msg) => console.log(`${COLOR.red}[MergeQueue] [ERROR]${COLOR.reset} ${msg}`);

const SCRIPT_DIR = import.meta.dirname;
const STAGING_REF = '_integration_staging';
const ORPHAN_WORKTREE_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_GATE_TIMEOUT_MS = 60_000;
const DEFAULT_GATE_CMDS = ['npm test', 'npm run lint'];

/**
 * serial-merge-queue.mjs
 *
 * Single-lane serial integration of one strike branch into `main`. The
 * candidate is built and validated on a throwaway `_integration_staging`
 * ref; `main` only ever moves by a `--ff-only` promotion of an already-green
 * tree, so an Iron Gate failure can never leave a broken commit on `main`.
 *
 * Concurrency locking (and the swarm provisioner that would feed this) is
 * intentionally NOT implemented yet -- this assumes a single invocation.
 */

function parseArgs(argv) {
  const out = { push: false, gateTimeoutMs: DEFAULT_GATE_TIMEOUT_MS };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const eat = (key) => {
      if (arg === `--${key}`) return argv[++i];
      if (arg.startsWith(`--${key}=`)) return arg.slice(key.length + 3);
      return undefined;
    };
    if (arg === '--push') { out.push = true; continue; }
    const branch = eat('branch');
    if (branch !== undefined) { out.branch = branch; continue; }
    const packet = eat('packet-id');
    if (packet !== undefined) { out.packetId = packet; continue; }
    const timeout = eat('gate-timeout-ms');
    if (timeout !== undefined) { out.gateTimeoutMs = Number(timeout); continue; }
  }
  return out;
}

function git(args, opts = {}) {
  const out = execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts });
  return typeof out === 'string' ? out.trim() : '';
}

function tryGit(args) {
  try { git(args); return true; } catch { return false; }
}

function gateCommands() {
  const raw = process.env.MERGE_QUEUE_GATE_CMDS;
  if (!raw) return DEFAULT_GATE_CMDS;
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.some((c) => typeof c !== 'string')) {
    throw new Error('MERGE_QUEUE_GATE_CMDS must be a JSON array of strings');
  }
  return parsed;
}

class GateError extends Error {
  constructor(reason, message) {
    super(message);
    this.reason = reason;
  }
}

/**
 * Run one gate command under a hard timeout. Non-zero exit -> IRON_GATE_FAILURE;
 * timeout kill -> IRON_GATE_TIMEOUT. Output is captured (not inherited) so it
 * can be folded into the quarantine bundle, and echoed on failure.
 */
function runGate(cmd, timeoutMs, sink) {
  logInfo(`Iron Gate: ${cmd} (timeout ${timeoutMs}ms)`);
  const res = spawnSync(cmd, {
    shell: true,
    encoding: 'utf8',
    timeout: timeoutMs,
    killSignal: 'SIGKILL',
  });
  sink.stdout += `\n$ ${cmd}\n${res.stdout ?? ''}`;
  sink.stderr += `\n$ ${cmd}\n${res.stderr ?? ''}`;
  const timedOut = res.error && (res.error.code === 'ETIMEDOUT' || res.error.killed);
  if (timedOut) {
    logError(`Gate command timed out after ${timeoutMs}ms: ${cmd}`);
    if (res.stdout) console.log(res.stdout);
    if (res.stderr) console.error(res.stderr);
    throw new GateError('IRON_GATE_TIMEOUT', `Gate command timed out: ${cmd}`);
  }
  if (res.error) {
    throw new GateError('IRON_GATE_FAILURE', `Gate command could not start: ${cmd} (${res.error.message})`);
  }
  if (res.status !== 0) {
    logError(`Gate command failed (exit ${res.status}): ${cmd}`);
    if (res.stdout) console.log(res.stdout);
    if (res.stderr) console.error(res.stderr);
    throw new GateError('IRON_GATE_FAILURE', `Gate command failed (exit ${res.status}): ${cmd}`);
  }
}

/** Remove any `.worktrees/*` older than the TTL, then prune stale metadata. */
function reapOrphanWorktrees() {
  const dir = path.resolve(process.cwd(), '.worktrees');
  if (!fs.existsSync(dir)) return;
  const now = Date.now();
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const full = path.join(dir, entry.name);
    let mtimeMs;
    try { mtimeMs = fs.statSync(full).mtimeMs; } catch { continue; }
    if (now - mtimeMs < ORPHAN_WORKTREE_TTL_MS) continue;
    logWarn(`Reaping orphan worktree (age ${Math.round((now - mtimeMs) / 3600000)}h): ${full}`);
    tryGit(['worktree', 'remove', full, '--force']);
  }
  tryGit(['worktree', 'prune']);
}

function cleanupScratch(branchName, packetId) {
  tryGit(['branch', '-D', STAGING_REF]);
  tryGit(['worktree', 'remove', path.join('.worktrees', packetId), '--force']);
  tryGit(['worktree', 'prune']);
  if (branchName) tryGit(['branch', '-D', branchName]);
}

function quarantine(packetId, reason, baseSha, branchName, sink, diff, mergeSha) {
  logWarn(`Quarantining failed packet ${packetId} (${reason})...`);
  const res = spawnSync('node', [
    path.join(SCRIPT_DIR, 'quarantine-packet.mjs'),
    `--packet-id=${packetId}`,
    `--reason=${reason}`,
    `--base-sha=${baseSha}`,
    `--branch=${branchName ?? ''}`,
  ], {
    encoding: 'utf8',
    input: JSON.stringify({ stdout: sink.stdout, stderr: sink.stderr, diff: diff ?? '', mergeSha: mergeSha ?? null }),
    stdio: ['pipe', 'inherit', 'inherit'],
  });
  if (res.status !== 0) logError(`Quarantine helper exited ${res.status}`);
}

async function processMerge() {
  const { branch: branchName, packetId, push, gateTimeoutMs } = parseArgs(process.argv.slice(2));

  if (!branchName || !packetId) {
    logError('Usage: node scripts/serial-merge-queue.mjs --branch=<branch> --packet-id=<id> [--push] [--gate-timeout-ms=<n>]');
    process.exit(1);
  }
  if (!Number.isFinite(gateTimeoutMs) || gateTimeoutMs <= 0) {
    logError('--gate-timeout-ms must be a positive number');
    process.exit(1);
  }

  reapOrphanWorktrees();

  // Preflight -- failures here are operator/environment faults, not packet
  // faults, so they exit without quarantining.
  if (!tryGit(['remote', 'get-url', 'origin'])) {
    logError('NO_ORIGIN: no `origin` remote configured');
    process.exit(1);
  }
  if (git(['status', '--porcelain']) !== '') {
    logError('DIRTY_WORKTREE: primary checkout has uncommitted changes; refusing to integrate');
    process.exit(1);
  }

  logInfo(`Integrating "${branchName}" for packet "${packetId}"...`);
  git(['checkout', 'main'], { stdio: 'inherit' });
  git(['pull', '--rebase', 'origin', 'main'], { stdio: 'inherit' });
  const baseSha = git(['rev-parse', 'HEAD']);

  const sink = { stdout: '', stderr: '' };
  let stagingBuilt = false;

  try {
    git(['branch', '-f', STAGING_REF, 'main']);
    git(['checkout', STAGING_REF], { stdio: 'inherit' });
    stagingBuilt = true;
    try {
      git(['merge', '--no-ff', branchName, '-m', `chore(strike): integrate ${packetId}`], { stdio: 'inherit' });
    } catch (mergeErr) {
      throw new GateError('MERGE_CONFLICT', `Merge of ${branchName} onto main failed: ${mergeErr.message}`);
    }

    for (const cmd of gateCommands()) runGate(cmd, gateTimeoutMs, sink);

    const mergeSha = git(['rev-parse', 'HEAD']);
    logInfo(`Iron Gate passed. Promoting ${packetId} (${mergeSha.slice(0, 10)}) to main.`);
    git(['checkout', 'main'], { stdio: 'inherit' });
    git(['merge', '--ff-only', STAGING_REF], { stdio: 'inherit' });

    if (push) {
      git(['push', 'origin', 'main'], { stdio: 'inherit' });
      logInfo('Pushed to origin/main.');
    } else {
      logWarn('Promoted to local main. Remote push not requested.');
    }

    git(['branch', '-d', STAGING_REF]);
    tryGit(['worktree', 'remove', path.join('.worktrees', packetId), '--force']);
    tryGit(['worktree', 'prune']);
    git(['branch', '-d', branchName]);
    logInfo('Merge queue cycle completed cleanly.');
    process.exit(0);
  } catch (err) {
    const reason = err instanceof GateError ? err.reason : 'IRON_GATE_FAILURE';
    logError(`Integration failed for ${packetId}: ${err.message}`);

    let diff = '';
    let mergeSha = null;
    if (stagingBuilt) {
      try { diff = git(['diff', baseSha, STAGING_REF]); } catch { /* staging may be gone */ }
      try { mergeSha = git(['rev-parse', STAGING_REF]); } catch { /* staging may be gone */ }
    }
    tryGit(['checkout', 'main']);
    tryGit(['reset', '--hard', baseSha]);
    cleanupScratch(branchName, packetId);
    quarantine(packetId, reason, baseSha, branchName, sink, diff, mergeSha);
    process.exit(1);
  }
}

processMerge();
