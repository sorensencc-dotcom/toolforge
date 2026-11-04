import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOK_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), '../.claude/hooks/token-budget-gate.js');

function git(cwd, ...args) {
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, stdio: 'ignore' });
}

// Temp repo on `main` with one base commit, then a feature branch.
function makeRepo() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'budget-gate-'));
  git(cwd, 'init', '-q', '-b', 'main');
  fs.writeFileSync(path.join(cwd, 'a.txt'), 'base\n');
  git(cwd, 'add', '.');
  git(cwd, 'commit', '-q', '-m', 'base');
  git(cwd, 'checkout', '-q', '-b', 'feature');
  return cwd;
}

function lines(n) {
  return Array.from({ length: n }, (_, i) => `line ${i}`).join('\n') + '\n';
}

function runHook(cwd, env = {}) {
  const r = spawnSync(process.execPath, [HOOK_PATH], {
    cwd, input: '{}', encoding: 'utf8', timeout: 20000,
    env: { ...process.env, COMMIT_THRESHOLD: '999', TOKEN_BUDGET_MAX_LINES: '', PLAN_LOCKED: '', ...env },
  });
  const denied = r.stdout.trim() !== '' &&
    JSON.parse(r.stdout).hookSpecificOutput.permissionDecision === 'deny';
  return { status: r.status, stderr: r.stderr, denied };
}

function withRepo(fn) {
  const cwd = makeRepo();
  try { fn(cwd); } finally { fs.rmSync(cwd, { recursive: true, force: true }); }
}

test('passes when branch edits are under the line limit', () => withRepo((cwd) => {
  fs.writeFileSync(path.join(cwd, 'b.txt'), lines(10));
  git(cwd, 'add', '.');
  git(cwd, 'commit', '-q', '-m', 'small');
  const r = runHook(cwd);
  assert.equal(r.status, 0);
  assert.equal(r.denied, false);
  assert.match(r.stderr, /Branch edit lines: 10 \(threshold: 1500\)/);
}));

test('blocks when committed + uncommitted edits exceed the limit', () => withRepo((cwd) => {
  fs.writeFileSync(path.join(cwd, 'b.txt'), lines(30));
  git(cwd, 'add', '.');
  git(cwd, 'commit', '-q', '-m', 'committed');
  fs.writeFileSync(path.join(cwd, 'a.txt'), lines(30)); // uncommitted: +30 -1
  const r = runHook(cwd, { TOKEN_BUDGET_MAX_LINES: '50' });
  assert.equal(r.status, 0);
  assert.match(r.stderr, /Branch edit lines: 61/);
  assert.equal(r.denied, true);
}));

test('default limit of 1500 blocks a large branch', () => withRepo((cwd) => {
  fs.writeFileSync(path.join(cwd, 'b.txt'), lines(1600));
  git(cwd, 'add', '.');
  git(cwd, 'commit', '-q', '-m', 'big');
  assert.equal(runHook(cwd).denied, true);
}));

test('PLAN_LOCKED=1 allows a branch over the limit', () => withRepo((cwd) => {
  fs.writeFileSync(path.join(cwd, 'b.txt'), lines(100));
  const r = runHook(cwd, { TOKEN_BUDGET_MAX_LINES: '50', PLAN_LOCKED: '1' });
  assert.equal(r.status, 0);
  assert.equal(r.denied, false);
  assert.match(r.stderr, /Plan locked/);
}));

test('fails open with a stderr note outside a git repo', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'budget-gate-nogit-'));
  try {
    const r = runHook(cwd, { TOKEN_BUDGET_MAX_LINES: '0' });
    assert.equal(r.status, 0);
    assert.equal(r.denied, false);
    assert.match(r.stderr, /fail open/);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});
