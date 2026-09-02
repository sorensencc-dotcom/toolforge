import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readPinnedSnapshot } from './viking-snapshot.mjs';

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'viking-pointer-'));
  const gen = path.join(root, '.nlm_pack', 'generations', '20260828_000000_abcd');
  fs.mkdirSync(gen, { recursive: true });
  fs.writeFileSync(path.join(gen, 'manifest.json'), JSON.stringify({ generation_id: '20260828_000000_abcd', sha256: 'sha256:abc' }));
  fs.writeFileSync(path.join(gen, 'FILES.manifest.txt'), 'wiki/example.md\\n');
  fs.writeFileSync(path.join(root, '.nlm_pack', 'current_generation.json'), JSON.stringify({ active_generation: '20260828_000000_abcd', sha256: 'sha256:abc' }));
  return root;
}

test('pins the generation named by the pointer', () => {
  const root = fixture();
  const pinned = readPinnedSnapshot({ vaultRoot: root });
  assert.equal(pinned.snapshotId, '20260828_000000_abcd');
  assert.equal(pinned.contentHash, 'sha256:abc');
});

test('fails closed when pointer and manifest disagree', () => {
  const root = fixture();
  const pointer = path.join(root, '.nlm_pack', 'current_generation.json');
  fs.writeFileSync(pointer, JSON.stringify({ active_generation: '20260828_000000_abcd', sha256: 'sha256:wrong' }));
  assert.throws(() => readPinnedSnapshot({ vaultRoot: root }), { code: 'INTEGRITY_FAILED' });
});
test('pins reads across atomic pointer replacement', () => {
  const root = fixture();
  const gen2 = path.join(root, '.nlm_pack', 'generations', '20260828_000001_new');
  fs.mkdirSync(path.join(gen2, 'sources'), { recursive: true });
  fs.writeFileSync(path.join(gen2, 'manifest.json'), JSON.stringify({ generation_id: '20260828_000001_new', sha256: 'sha256:def' }));
  fs.writeFileSync(path.join(gen2, 'FILES.manifest.txt'), 'sources/one.js\n');
  fs.writeFileSync(path.join(gen2, 'sources', 'one.js'), 'new');
  const pointer = path.join(root, '.nlm_pack', 'current_generation.json');
  const first = readPinnedSnapshot({ vaultRoot: root });
  fs.writeFileSync(pointer, JSON.stringify({ active_generation: '20260828_000001_new', sha256: 'sha256:def' }));
  const second = readPinnedSnapshot({ vaultRoot: root });
  assert.equal(first.snapshotId, '20260828_000000_abcd');
  assert.equal(second.snapshotId, '20260828_000001_new');
  assert.notEqual(first.snapshotRoot, second.snapshotRoot);
});