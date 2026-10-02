// tests/doc-sync-run.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runDocSync, parseArgs } from '../scripts/doc-sync/run.mjs';

function setup(rows) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'run-'));
  const registryPath = path.join(dir, 'reg.json');
  fs.writeFileSync(registryPath, JSON.stringify({ products: rows }));
  return { registryPath, receiptPath: path.join(dir, 'receipt.json') };
}

const row = (name, extra = {}) => ({
  name, repoPath: fs.mkdtempSync(path.join(os.tmpdir(), `repo-${name}-`)),
  remote: `git@github.com:sorensencc-dotcom/${name}.wiki.git`, sourceDir: 'wiki', enabled: true, ...extra,
});

const ok = (status) => async (p, { onPublished }) => {
  if (status !== 'DRY_RUN' && status !== 'FAILED') await onPublished?.('PUBLISHED_DIR');
  return { product: p.name, status, changed: [], pages: 3, remoteHead: 'a'.repeat(40), error: status === 'FAILED' ? 'boom' : undefined };
};

test('publishes enabled rows only, loads cache for ingest rows, writes drift receipt', async () => {
  const a = row('a');
  const b = row('b', { enabled: false });
  const c = row('c', { ingest: false });
  const { registryPath, receiptPath } = setup([a, b, c]);
  const loaded = [];
  const out = await runDocSync({ registryPath, receiptPath, publish: ok('SYNCHRONIZED'), loadCache: (p, dir) => loaded.push(`${p.name}:${dir}`) });
  assert.equal(out.ok, true);
  assert.deepEqual(out.results.map((r) => r.product), ['a', 'c']);
  assert.deepEqual(loaded, ['a:PUBLISHED_DIR']);
  const drift = JSON.parse(fs.readFileSync(path.join(a.repoPath, '.wiki-sync-receipt.json'), 'utf8'));
  assert.equal(drift.repository, 'a');
  assert.equal(drift.sync_status, 'SYNCHRONIZED');
  assert.equal(drift.total_pages_published, 3);
  assert.equal(drift.remote_wiki_head, 'a'.repeat(40));
  assert.equal(JSON.parse(fs.readFileSync(receiptPath, 'utf8')).ok, true);
});

test('one failure sets ok false, other products still run, no drift receipt for the failure', async () => {
  const a = row('a');
  const b = row('b');
  const { registryPath, receiptPath } = setup([a, b]);
  const publish = async (p, opts) => (p.name === 'a' ? ok('FAILED') : ok('UP_TO_DATE'))(p, opts);
  const out = await runDocSync({ registryPath, receiptPath, publish, loadCache: () => {} });
  assert.equal(out.ok, false);
  assert.deepEqual(out.results.map((r) => r.status), ['FAILED', 'UP_TO_DATE']);
  assert.equal(fs.existsSync(path.join(a.repoPath, '.wiki-sync-receipt.json')), false);
  assert.equal(fs.existsSync(path.join(b.repoPath, '.wiki-sync-receipt.json')), true);
});

test('--product selects one row even when disabled; unknown name throws', async () => {
  const { registryPath, receiptPath } = setup([row('a'), row('b', { enabled: false })]);
  const seen = [];
  await runDocSync({ registryPath, receiptPath, only: 'b', dryRun: true, publish: async (p) => { seen.push(p.name); return { product: p.name, status: 'DRY_RUN', changed: [], pages: 0 }; } });
  assert.deepEqual(seen, ['b']);
  await assert.rejects(runDocSync({ registryPath, receiptPath, only: 'zzz', publish: async () => ({}) }), /UNKNOWN_PRODUCT: zzz/);
});

test('parseArgs rejects unknown or malformed flags', () => {
  assert.deepEqual(parseArgs(['--dry-run', '--product=trm']), { dryRun: true, only: 'trm' });
  assert.deepEqual(parseArgs([]), { dryRun: false, only: undefined });
  for (const bad of [['--dryrun'], ['--product'], ['--product='], ['trm'], ['--ingest']]) {
    assert.throws(() => parseArgs(bad), /BAD_ARGS/, bad.join(' '));
  }
});

test('no enabled products is a failure, not a silent success', async () => {
  const { registryPath, receiptPath } = setup([row('a', { enabled: false })]);
  await assert.rejects(runDocSync({ registryPath, receiptPath, publish: ok('SYNCHRONIZED') }), /NO_PRODUCTS_SELECTED/);
});

test('a second concurrent run is refused by the lock', async () => {
  const { registryPath, receiptPath } = setup([row('a')]);
  let release;
  const slow = (p) => new Promise((resolve) => { release = () => resolve({ product: p.name, status: 'UP_TO_DATE', changed: [], deleted: [], pages: 1 }); });
  const first = runDocSync({ registryPath, receiptPath, publish: slow, loadCache: () => {} });
  await new Promise((r) => setTimeout(r, 50));
  await assert.rejects(runDocSync({ registryPath, receiptPath, publish: slow, loadCache: () => {} }), /RUN_LOCKED/);
  release();
  assert.equal((await first).ok, true);
});

test('dry run writes no drift receipt and loads no cache', async () => {
  const a = row('a');
  const { registryPath, receiptPath } = setup([a]);
  let loaded = 0;
  await runDocSync({ registryPath, receiptPath, dryRun: true, publish: ok('DRY_RUN'), loadCache: () => { loaded++; } });
  assert.equal(loaded, 0);
  assert.equal(fs.existsSync(path.join(a.repoPath, '.wiki-sync-receipt.json')), false);
});
