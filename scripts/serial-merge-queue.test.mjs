import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const QUEUE = fileURLToPath(new URL('./serial-merge-queue.mjs', import.meta.url));

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

/**
 * Build a fixture: bare origin + working clone with `main` pushed, plus a
 * pre-provisioned strike worktree+branch carrying one commit (what the
 * deferred swarm provisioner would have produced).
 */
function makeFixture(packetId = 'pkt-101') {
  const root = mkdtempSync(path.join(tmpdir(), 'smq-'));
  const origin = path.join(root, 'origin.git');
  const work = path.join(root, 'work');
  execFileSync('git', ['init', '-b', 'main', '--bare', origin]);
  execFileSync('git', ['clone', origin, work]);
  git(work, ['config', 'user.email', 'test@example.com']);
  git(work, ['config', 'user.name', 'Test']);
  writeFileSync(path.join(work, 'base.txt'), 'base\n');
  writeFileSync(path.join(work, '.gitignore'), '.worktrees/\n.quarantine/\n');
  git(work, ['add', '-A']);
  git(work, ['commit', '-m', 'base']);
  git(work, ['push', 'origin', 'main']);
  const branch = `strike/${packetId}`;
  const wt = path.join(work, '.worktrees', packetId);
  git(work, ['worktree', 'add', '-b', branch, wt, 'main']);
  writeFileSync(path.join(wt, `feat-${packetId}.txt`), 'feature\n');
  git(wt, ['add', '-A']);
  git(wt, ['commit', '-m', `feat ${packetId}`]);
  return { root, origin, work, branch, packetId, wt, baseSha: git(work, ['rev-parse', 'main']) };
}

/**
 * Best-effort recursive delete. A gate command killed by timeout can briefly
 * outlive the kill on Windows and hold a handle on the fixture dir; the OS
 * reaps the temp dir regardless, so EPERM/EBUSY here is not a test failure.
 */
function cleanup(root) {
  try {
    rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 });
  } catch { /* temp dir; OS will collect it */ }
}

function runQueue(work, args, env = {}) {
  return spawnSync('node', [QUEUE, ...args], {
    cwd: work,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

function quarantineManifest(work) {
  const qroot = path.join(work, '.quarantine');
  if (!existsSync(qroot)) return null;
  for (const pkt of readdirSync(qroot)) {
    for (const ts of readdirSync(path.join(qroot, pkt))) {
      const mf = path.join(qroot, pkt, ts, 'manifest.json');
      if (existsSync(mf)) return JSON.parse(readFileSync(mf, 'utf8'));
    }
  }
  return null;
}

test('green gate: main advances by a --no-ff merge, scratch refs pruned, origin untouched without --push', () => {
  const f = makeFixture('pkt-green');
  try {
    const r = runQueue(f.work, [`--branch=${f.branch}`, `--packet-id=${f.packetId}`], {
      MERGE_QUEUE_GATE_CMDS: JSON.stringify(['node -e "process.exit(0)"']),
    });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const head = git(f.work, ['rev-parse', 'main']);
    assert.notEqual(head, f.baseSha);
    assert.equal(git(f.work, ['rev-list', '--parents', '-n', '1', 'main']).split(' ').length, 3, 'merge commit has two parents');
    assert.equal(git(f.work, ['branch', '--list', f.branch]), '');
    assert.equal(git(f.work, ['branch', '--list', '_integration_staging']), '');
    assert.ok(!existsSync(f.wt), 'worktree removed');
    assert.equal(quarantineManifest(f.work), null);
    git(f.work, ['fetch', 'origin']);
    assert.equal(git(f.work, ['rev-parse', 'origin/main']), f.baseSha, 'origin/main not pushed');
    assert.match(r.stdout, /Remote push not requested/);
  } finally {
    cleanup(f.root);
  }
});

test('red gate: main stays at base, scratch refs pruned, quarantine records IRON_GATE_FAILURE', () => {
  const f = makeFixture('pkt-red');
  try {
    const r = runQueue(f.work, [`--branch=${f.branch}`, `--packet-id=${f.packetId}`], {
      MERGE_QUEUE_GATE_CMDS: JSON.stringify(['node -e "process.exit(1)"']),
    });
    assert.equal(r.status, 1);
    assert.equal(git(f.work, ['rev-parse', 'main']), f.baseSha);
    assert.equal(git(f.work, ['branch', '--list', f.branch]), '');
    assert.equal(git(f.work, ['branch', '--list', '_integration_staging']), '');
    assert.ok(!existsSync(f.wt));
    const mf = quarantineManifest(f.work);
    assert.ok(mf, 'quarantine manifest written');
    assert.equal(mf.reason, 'IRON_GATE_FAILURE');
    assert.equal(mf.packetId, f.packetId);
    assert.equal(mf.baseSha, f.baseSha);
  } finally {
    cleanup(f.root);
  }
});

test('hung gate: killed at --gate-timeout-ms, quarantine records IRON_GATE_TIMEOUT, main unchanged', () => {
  const f = makeFixture('pkt-hang');
  try {
    const r = runQueue(
      f.work,
      [`--branch=${f.branch}`, `--packet-id=${f.packetId}`, '--gate-timeout-ms=400'],
      { MERGE_QUEUE_GATE_CMDS: JSON.stringify(['node -e "setTimeout(()=>{}, 2500)"']) },
    );
    assert.equal(r.status, 1);
    assert.equal(git(f.work, ['rev-parse', 'main']), f.baseSha);
    const mf = quarantineManifest(f.work);
    assert.ok(mf);
    assert.equal(mf.reason, 'IRON_GATE_TIMEOUT');
  } finally {
    cleanup(f.root);
  }
});

test('--push: origin/main fast-forwards to the promoted merge', () => {
  const f = makeFixture('pkt-push');
  try {
    const r = runQueue(f.work, [`--branch=${f.branch}`, `--packet-id=${f.packetId}`, '--push'], {
      MERGE_QUEUE_GATE_CMDS: JSON.stringify(['node -e "process.exit(0)"']),
    });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const head = git(f.work, ['rev-parse', 'main']);
    git(f.work, ['fetch', 'origin']);
    assert.equal(git(f.work, ['rev-parse', 'origin/main']), head);
  } finally {
    cleanup(f.root);
  }
});

test('dirty primary checkout: fails fast with DIRTY_WORKTREE, no merge, no quarantine', () => {
  const f = makeFixture('pkt-dirty');
  try {
    writeFileSync(path.join(f.work, 'uncommitted.txt'), 'dirty\n');
    const r = runQueue(f.work, [`--branch=${f.branch}`, `--packet-id=${f.packetId}`], {
      MERGE_QUEUE_GATE_CMDS: JSON.stringify(['node -e "process.exit(0)"']),
    });
    assert.equal(r.status, 1);
    assert.match(r.stdout + r.stderr, /DIRTY_WORKTREE/);
    assert.equal(git(f.work, ['rev-parse', 'main']), f.baseSha);
    assert.equal(quarantineManifest(f.work), null);
  } finally {
    cleanup(f.root);
  }
});
