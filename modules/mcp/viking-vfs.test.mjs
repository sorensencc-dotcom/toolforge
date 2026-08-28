import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createResolver } from './viking-resolver.mjs';
import { createServer, toJsonRpcResponse } from './viking-vfs-server.mjs';

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'viking-'));
  const snapshot = path.join(root, '_kb-sync-staging', '20260828-000000');
  fs.mkdirSync(path.join(snapshot, 'wiki', 'concepts'), { recursive: true });
  fs.mkdirSync(path.join(snapshot, 'sources'), { recursive: true });
  fs.mkdirSync(path.join(snapshot, 'schema'), { recursive: true });
  fs.writeFileSync(path.join(snapshot, 'wiki', 'concepts', 'one.md'), '# One');
  fs.writeFileSync(path.join(snapshot, 'sources', 'one.js'), 'export const one = 1;');

  fs.writeFileSync(path.join(snapshot, 'FILES.manifest.txt'), 'wiki/concepts/one.md\nsources/one.js');

  return { root, snapshot };
}

test('reads immutable L2 snapshot and lists sorted children', () => {
  const f = fixture();
  const resolver = createResolver({ vaultRoot: f.root, vaultName: 'kb-sync', snapshotId: '20260828-000000' });
  assert.equal(resolver.read('viking://kb-sync/sources/one.js', 'L2').content, 'export const one = 1;');
  assert.deepEqual(resolver.list('viking://kb-sync/wiki/concepts').files.map((x) => x.name), ['one.md']);
});

test('rejects foreign namespaces and traversal', () => {
  const f = fixture();
  const resolver = createResolver({ vaultRoot: f.root, vaultName: 'kb-sync', snapshotId: '20260828-000000' });
  assert.throws(() => resolver.stat('viking://other/wiki/concepts/one.md'), { code: 'NAMESPACE_REJECTED' });
  assert.throws(() => resolver.stat('viking://kb-sync/wiki/../sources/one.js'), { code: 'PATH_TRAVERSAL_REJECTED' });
});

test('maps errors at MCP boundary without leaking physical paths', async () => {
  const f = fixture();
  const server = createServer(createResolver({ vaultRoot: f.root, vaultName: 'kb-sync', snapshotId: '20260828-000000' }));
  const response = await server.handle({ method: 'viking/stat', params: { uri: 'viking://other/wiki/x' } });
  assert.equal(response.error.code, 'NAMESPACE_REJECTED');
  assert.equal(JSON.stringify(response).includes(f.root), false);
});

test('returns stable errors for unavailable snapshot and tier', () => {
  const f = fixture();
  const missing = createResolver({ vaultRoot: f.root, vaultName: 'kb-sync', snapshotId: 'missing' });
  assert.throws(() => missing.stat('viking://kb-sync/wiki'), { code: 'SNAPSHOT_UNAVAILABLE' });
  const resolver = createResolver({ vaultRoot: f.root, vaultName: 'kb-sync', snapshotId: '20260828-000000' });
  assert.throws(() => resolver.read('viking://kb-sync/wiki/concepts/one.md', 'L1'), { code: 'TIER_UNAVAILABLE' });
  assert.throws(() => resolver.stat('viking://kb-sync/wiki/%E0%A4%A'), { code: 'INVALID_URI' });
});
test('paginates lists with bounded limits', () => {
  const f = fixture();
  fs.writeFileSync(path.join(f.snapshot, 'wiki', 'concepts', 'two.md'), '# Two');
  const resolver = createResolver({ vaultRoot: f.root, vaultName: 'kb-sync', snapshotId: '20260828-000000' });
  const page = resolver.list('viking://kb-sync/wiki/concepts', { limit: 1 });
  assert.equal(page.files.length, 1);
  assert.equal(page.complete, false);
  assert.equal(page.next_offset, 1);
  assert.throws(() => resolver.list('viking://kb-sync/wiki/concepts', { limit: 101 }), { code: 'INVALID_URI' });
});
test('rejects malformed MCP request envelopes', async () => {
  const f = fixture();
  const server = createServer(createResolver({ vaultRoot: f.root, vaultName: 'kb-sync', snapshotId: '20260828-000000' }));
  assert.equal((await server.handle({ method: 'viking/stat', params: {} })).error.code, 'INVALID_REQUEST');
  assert.equal((await server.handle({ params: {} })).error.code, 'INVALID_REQUEST');
});
test('formats MCP success and error envelopes correctly', () => {
  assert.deepEqual(toJsonRpcResponse(1, { ok: true }), { jsonrpc: '2.0', id: 1, result: { ok: true } });
  assert.deepEqual(toJsonRpcResponse(2, { error: { code: 'INVALID_REQUEST' } }), { jsonrpc: '2.0', id: 2, error: { code: 'INVALID_REQUEST' } });
});