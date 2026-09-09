import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HELPER = fileURLToPath(new URL('./quarantine-packet.mjs', import.meta.url));

function run(cwd, args, payload) {
  return spawnSync('node', [HELPER, ...args], {
    cwd,
    encoding: 'utf8',
    input: JSON.stringify(payload),
  });
}

function onlyIncident(cwd, packetId) {
  const base = path.join(cwd, '.quarantine', packetId);
  const stamps = readdirSync(base);
  assert.equal(stamps.length, 1, 'one incident dir');
  return path.join(base, stamps[0]);
}

test('writes a bundle under .quarantine/<packet>/<timestamp>/ and never touches wiki/', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'qp-'));
  try {
    const r = run(
      cwd,
      ['--packet-id=pkt-9', '--reason=IRON_GATE_FAILURE', '--base-sha=abc123', '--branch=strike/pkt-9'],
      { stdout: 'gate out', stderr: 'gate err', diff: 'DIFF BODY', mergeSha: 'def456' },
    );
    assert.equal(r.status, 0, r.stdout + r.stderr);

    const dir = onlyIncident(cwd, 'pkt-9');
    const manifest = JSON.parse(readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
    assert.equal(manifest.packetId, 'pkt-9');
    assert.equal(manifest.reason, 'IRON_GATE_FAILURE');
    assert.equal(manifest.baseSha, 'abc123');
    assert.equal(manifest.branch, 'strike/pkt-9');
    assert.equal(manifest.mergeSha, 'def456');
    assert.match(manifest.timestamp, /^\d{4}-\d{2}-\d{2}T/);

    assert.equal(readFileSync(path.join(dir, 'gate-stdout.log'), 'utf8'), 'gate out');
    assert.equal(readFileSync(path.join(dir, 'gate-stderr.log'), 'utf8'), 'gate err');
    assert.equal(readFileSync(path.join(dir, 'changes.diff'), 'utf8'), 'DIFF BODY');

    assert.ok(!existsSync(path.join(cwd, 'wiki')), 'no wiki/ side effect');
  } finally {
    rmSync(cwd, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
});

test('sanitizes packet id and tolerates an empty stdin payload', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'qp-'));
  try {
    const r = spawnSync('node', [HELPER, '--packet-id=weird/../id', '--reason=MERGE_CONFLICT'], {
      cwd, encoding: 'utf8', input: '',
    });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const pkts = readdirSync(path.join(cwd, '.quarantine'));
    assert.deepEqual(pkts, ['weird____id']);
    const dir = onlyIncident(cwd, 'weird____id');
    const manifest = JSON.parse(readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
    assert.equal(manifest.reason, 'MERGE_CONFLICT');
    assert.equal(manifest.mergeSha, null);
    assert.equal(readFileSync(path.join(dir, 'changes.diff'), 'utf8'), '');
  } finally {
    rmSync(cwd, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
});
