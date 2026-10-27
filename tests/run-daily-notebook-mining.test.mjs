import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve, join, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  isMultipartNotebook,
  loadMultipartNotebookIds,
  miningPaths,
  resolveMiningDataRoot,
  runPackSync,
  validateDAGSequence,
} from '../scripts/run-daily-notebook-mining.mjs';

test('resolveMiningDataRoot fails closed when MINING_DATA_ROOT is unset or blank', () => {
  assert.throws(() => resolveMiningDataRoot({}), /^Error: MINING_DATA_ROOT_UNSET/);
  assert.throws(() => resolveMiningDataRoot({ MINING_DATA_ROOT: '  ' }), /^Error: MINING_DATA_ROOT_UNSET/);
});

test('mining data paths live under MINING_DATA_ROOT, not the script checkout', () => {
  const checkout = resolve(fileURLToPath(new URL('..', import.meta.url)));
  const dataRoot = resolveMiningDataRoot({ MINING_DATA_ROOT: join(tmpdir(), 'mining-data-root-test') });
  assert.equal(dataRoot, resolve(tmpdir(), 'mining-data-root-test'));
  for (const p of Object.values(miningPaths(dataRoot))) {
    assert.equal(p.startsWith(dataRoot), true, p);
    assert.equal(p.startsWith(checkout + sep), false, p);
  }
});

test('KB_SYNC_ROOT defaults to <dataRoot>/kb-sync and requires MINING_DATA_ROOT', () => {
  let read;
  loadMultipartNotebookIds({ MINING_DATA_ROOT: '/data/root' }, (p) => { read = p; return '{}'; });
  assert.equal(read, join(resolve('/data/root'), 'kb-sync', 'state', 'knowledge-plane-notebooks.json'));
  assert.throws(() => loadMultipartNotebookIds({}, () => '{}'), /MINING_DATA_ROOT_UNSET/);
});

test('run-daily-notebook-mining script exists and exports required functions', () => {
  const scriptPath = resolve('scripts/run-daily-notebook-mining.mjs');
  assert.equal(existsSync(scriptPath), true);
  assert.equal(typeof runPackSync, 'function');
  assert.equal(typeof validateDAGSequence, 'function');
});

test('validateDAGSequence enforces strict phase execution order', () => {
  const validPhases = ['load-category', 'harvest', 'extract-properties', 'consolidate-pack', 'validate-pack', 'sync-notebooklm'];
  assert.equal(validateDAGSequence(validPhases), true);

  assert.throws(() => {
    validateDAGSequence(['harvest', 'load-category', 'extract-properties', 'consolidate-pack', 'validate-pack', 'sync-notebooklm']);
  }, /DAG_VALIDATION_ERROR/);
});

const DAILY_ID = '1b4861a3-931f-4632-8fc1-343a8dd37df8';
test('multipart set includes fallback IDs when the kb-sync manifest is missing', () => {
  const ids = loadMultipartNotebookIds({ KB_SYNC_MANIFEST_PATH: '/nope/missing.json' }, () => { throw new Error('ENOENT'); });
  for (const id of [DAILY_ID, '679b8bab-2d87-42cb-a726-6dc54c83acc2', '359b346c-6af7-4ba3-baef-b985c9e6e1af']) {
    assert.equal(isMultipartNotebook(id, ids), true);
  }
  assert.equal(isMultipartNotebook('unrelated-id', ids), false);
});

test('registry notebooks marked multipart (multipart:true or expected_parts>1) are skipped', () => {
  const manifest = JSON.stringify({
    clusters: {
      c1: { notebooks: [{ uuid: 'ABC-123', multipart: true }, { uuid: 'def-456', expected_parts: 3 }] },
    },
  });
  const ids = loadMultipartNotebookIds({ KB_SYNC_MANIFEST_PATH: '/m.json' }, () => manifest);
  assert.equal(isMultipartNotebook('abc-123', ids), true);
  assert.equal(isMultipartNotebook('def-456', ids), true);
  assert.equal(isMultipartNotebook(DAILY_ID, ids), true);
});

test('single-pack registry notebooks are not treated as multipart', () => {
  const manifest = JSON.stringify({
    clusters: {
      c1: {
        notebooks: [
          { uuid: 'personal-os-id' },
          { uuid: 'modules-id', multipart: false, expected_parts: 1 },
        ],
      },
    },
  });
  const ids = loadMultipartNotebookIds({ KB_SYNC_MANIFEST_PATH: '/m.json' }, () => manifest);
  assert.equal(isMultipartNotebook('personal-os-id', ids), false);
  assert.equal(isMultipartNotebook('modules-id', ids), false);
});

const packArgs = (syncPackFn) => ({
  syncPackFn,
  notebookId: DAILY_ID,
  packFile: '/x/.nlm_pack/pack_daily.txt',
  logInfo: () => {},
  logWarn: () => {},
});

test('runPackSync passes notebook and pack to syncPackFn and counts purged sources on success', async () => {
  let received;
  const res = await runPackSync(packArgs(async (args) => {
    received = args;
    return { success: true, purgedOldSourceIds: ['old-1', 'old-2'] };
  }));
  assert.equal(received.notebookId, DAILY_ID);
  assert.equal(received.packFile, '/x/.nlm_pack/pack_daily.txt');
  assert.deepEqual(res, { ok: true, pruned: 2 });
});

test('runPackSync reports a skip with the gate reason', async () => {
  const res = await runPackSync(packArgs(async () => ({ skipped: true, reason: 'MULTIPART_REGISTRY' })));
  assert.deepEqual(res, { ok: true, skipped: true, reason: 'MULTIPART_REGISTRY' });
});

test('runPackSync fails when the gate returns neither success nor skip', async () => {
  const res = await runPackSync(packArgs(async () => ({ success: false })));
  assert.deepEqual(res, { ok: false, reason: 'replace_gate_failed' });
});

test('runPackSync converts a gate throw into a failure and calls syncPackFn once', async () => {
  let calls = 0;
  const res = await runPackSync(packArgs(async () => { calls++; throw new Error('REPLACE_GATE_FAIL'); }));
  assert.deepEqual(res, { ok: false, reason: 'REPLACE_GATE_FAIL' });
  assert.equal(calls, 1);
});
