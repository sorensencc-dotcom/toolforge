import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  createManagedWorktree,
  runManagedWorktree,
  removeManagedWorktree,
} from './manager.js';

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }).trim();
}

function fixture() {
  const root = mkdtempSync(join(process.cwd(), '.tmp-worktree-'));
  const repo = join(root, 'repo');
  const worktreeRoot = join(root, 'managed');
  mkdirSync(repo, { recursive: true });
  git(['init', '-q'], repo);
  git(['config', 'user.email', 'test@example.invalid'], repo);
  git(['config', 'user.name', 'Toolforge Test'], repo);
  writeFileSync(join(repo, 'README.md'), 'fixture\n');
  mkdirSync(join(repo, '.trail', 'cache'), { recursive: true });
  writeFileSync(join(repo, '.trail', 'cache', 'manifest.json'), '{"fixture":true}\n');
  git(['add', 'README.md'], repo);
  git(['add', '.trail'], repo);
  git(['commit', '--no-verify', '-qm', 'fixture'], repo);
  return { root, repo, worktreeRoot };
}

function allowSafety() {
  return async () => ({ verdict: 'ALLOWED', classification: 'LOCAL_MUTATION', reason: 'test' });
}

function cleanup(root) {
  rmSync(root, { recursive: true, force: true });
}

test('create rejects dirty repositories unless an explicit base is supplied', () => {
  const f = fixture();
  try {
    writeFileSync(join(f.repo, 'dirty.txt'), 'dirty\n');
    assert.throws(() => createManagedWorktree({ repo: f.repo, name: 'dirty', worktreeRoot: f.worktreeRoot }), /REPOSITORY_DIRTY/);
    const manifest = createManagedWorktree({ repo: f.repo, name: 'clean-base', base: 'HEAD', worktreeRoot: f.worktreeRoot });
    assert.equal(manifest.state, 'created');
    assert.equal(existsSync(manifest.worktreePath), true);
    removeManagedWorktree({ repo: f.repo, name: 'clean-base', worktreeRoot: f.worktreeRoot, cleanup: true });
  } finally {
    cleanup(f.root);
  }
});
test('code runs fail before the child starts when Trail preflight fails', async () => {
  const f = fixture();
  try {
    createManagedWorktree({ repo: f.repo, name: 'blocked', worktreeRoot: f.worktreeRoot });
    const marker = join(f.root, 'child-ran');
    await assert.rejects(
      runManagedWorktree({
        repo: f.repo,
        name: 'blocked',
        worktreeRoot: f.worktreeRoot,
        command: [process.execPath, '-e', `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'ran')`],
        safety: allowSafety(),
        trail: async () => { throw new Error('no graph'); },
        trailQuery: 'worktree runner',
      }),
      /TRAIL_PREFLIGHT_FAILED/,
    );
    assert.equal(existsSync(marker), false);
    removeManagedWorktree({ repo: f.repo, name: 'blocked', worktreeRoot: f.worktreeRoot, cleanup: true });
  } finally {
    cleanup(f.root);
  }
});

test('code runs record Trail provenance and preserve the child exit result', async () => {
  const f = fixture();
  try {
    createManagedWorktree({ repo: f.repo, name: 'run', worktreeRoot: f.worktreeRoot });
    const marker = join(f.root, 'child-ran');
    const result = await runManagedWorktree({
      repo: f.repo,
      name: 'run',
      worktreeRoot: f.worktreeRoot,
      command: [process.execPath, '-e', `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'ran')`],
      safety: allowSafety(),
      trail: async () => ({ stdout: 'skeleton context\n', stderr: '' }),
      trailFile: 'scripts/worktree-safety-gate.mjs',
    });
    assert.equal(result.state, 'succeeded');
    assert.equal(existsSync(marker), true);
    const manifest = JSON.parse(readFileSync(join(f.worktreeRoot, 'run', 'manifest.json'), 'utf8'));
    assert.equal(manifest.state, 'succeeded');
    assert.equal(manifest.trail.file, 'scripts/worktree-safety-gate.mjs');
    assert.match(manifest.trail.graphRevision, /^[a-f0-9]{64}$/);
    removeManagedWorktree({ repo: f.repo, name: 'run', worktreeRoot: f.worktreeRoot, cleanup: true });
  } finally {
    cleanup(f.root);
  }
});

test('explicit non-code runs record a Trail exemption and still use argv execution', async () => {
  const f = fixture();
  try {
    createManagedWorktree({ repo: f.repo, name: 'non-code', worktreeRoot: f.worktreeRoot });
    const marker = join(f.root, 'literal;marker');
    const result = await runManagedWorktree({
      repo: f.repo,
      name: 'non-code',
      worktreeRoot: f.worktreeRoot,
      command: [process.execPath, '-e', `require('node:fs').writeFileSync(${JSON.stringify(marker)}, process.argv[1])`, 'literal;value'],
      nonCode: true,
      safety: allowSafety(),
      trail: async () => { throw new Error('Trail must not run for explicit non-code'); },
    });
    assert.equal(result.state, 'succeeded');
    assert.equal(readFileSync(marker, 'utf8'), 'literal;value');
    const manifest = JSON.parse(readFileSync(join(f.worktreeRoot, 'non-code', 'manifest.json'), 'utf8'));
    assert.equal(manifest.trail.exempt, true);
    removeManagedWorktree({ repo: f.repo, name: 'non-code', worktreeRoot: f.worktreeRoot, cleanup: true });
  } finally {
    cleanup(f.root);
  }
});

