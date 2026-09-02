import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createResolver } from './viking-resolver.mjs';
import { createServer, JSON_RPC_CODES, processJsonRpcLine, toJsonRpcResponse } from './viking-vfs-server.mjs';

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
  assert.equal(response.error.code, JSON_RPC_CODES.INVALID_PARAMS);
  assert.equal(response.error.data.viking_code, 'NAMESPACE_REJECTED');
  assert.equal(JSON.stringify(response).includes(f.root), false);
});

test('returns stable errors for unavailable snapshot and tier', () => {
  const f = fixture();
  assert.throws(() => createResolver({ vaultRoot: f.root, vaultName: 'kb-sync', snapshotId: 'missing' }), { code: 'SNAPSHOT_UNAVAILABLE' });
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
  assert.equal((await server.handle({ method: 'viking/stat', params: {} })).error.code, JSON_RPC_CODES.INVALID_REQUEST);
  assert.equal((await server.handle({ params: {} })).error.code, JSON_RPC_CODES.INVALID_REQUEST);
});
test('formats MCP success and error envelopes correctly', () => {
  assert.deepEqual(toJsonRpcResponse(1, { ok: true }), { jsonrpc: '2.0', id: 1, result: { ok: true } });
  assert.deepEqual(toJsonRpcResponse(2, { error: { code: -32600, message: 'bad' } }), { jsonrpc: '2.0', id: 2, error: { code: -32600, message: 'bad' } });
});
test('rejects tier metadata from another snapshot', () => {
  const f = fixture();
  const resolver = createResolver({
    vaultRoot: f.root,
    vaultName: 'kb-sync',
    snapshotId: '20260828-000000',
    tierIndex: { 'viking://kb-sync/wiki/concepts/one.md:L1': { snapshot_id: 'other', source_hash: 'x', tier_hash: 'y', artifact: 'wiki/concepts/one.md' } },
  });
  assert.throws(() => resolver.read('viking://kb-sync/wiki/concepts/one.md', 'L1'), { code: 'INTEGRITY_FAILED' });
});
test('rejects omitted manifest files and symlink escapes', () => {
  const f = fixture();
  fs.writeFileSync(path.join(f.snapshot, 'sources', 'omitted.js'), 'not listed');
  assert.throws(() => createResolver({ vaultRoot: f.root, vaultName: 'kb-sync', snapshotId: '20260828-000000' }).stat('viking://kb-sync/sources/omitted.js'), { code: 'MANIFEST_INVALID' });
  const outside = path.join(f.root, 'outside.js');
  fs.writeFileSync(outside, 'outside');
  try { fs.symlinkSync(outside, path.join(f.snapshot, 'sources', 'escape.js')); } catch (error) { if (error.code === 'EPERM') return; throw error; }
  fs.appendFileSync(path.join(f.snapshot, 'FILES.manifest.txt'), '\nsources/escape.js');
  assert.throws(() => createResolver({ vaultRoot: f.root, vaultName: 'kb-sync', snapshotId: '20260828-000000' }).stat('viking://kb-sync/sources/escape.js'), { code: 'PATH_TRAVERSAL_REJECTED' });
});
test('rejects non-timestamped snapshot identities', () => {
  const f = fixture();
  assert.throws(() => createResolver({ vaultRoot: f.root, vaultName: 'kb-sync', snapshotId: 'latest' }), { code: 'SNAPSHOT_UNAVAILABLE' });
});
test('supports standard MCP resource listing without a URI', async () => {
  const f = fixture();
  const server = createServer(createResolver({ vaultRoot: f.root, vaultName: 'kb-sync', snapshotId: '20260828-000000' }));
  const init = await server.handle({ method: 'initialize', params: {} });
  const listing = await server.handle({ method: 'resources/list', params: {} });
  assert.equal(init.capabilities.resources.listChanged, false);
  assert.ok(Array.isArray(listing.resources));
});

test('uses SQLite-style tier lookup for inline L0 abstracts and stat freshness', () => {
  const f = fixture();
  const content = fs.readFileSync(path.join(f.snapshot, 'wiki', 'concepts', 'one.md'));
  const hash = crypto.createHash('sha256').update(content).digest('hex');
  const tierIndex = {
    get(snapshotId, resourceUri, tier) {
      if (tier !== 'L0' || resourceUri !== 'viking://kb-sync/wiki/concepts/one.md') return null;
      return { snapshot_id: snapshotId, uri: resourceUri, tier, source_hash: hash, tier_hash: hash, artifact: 'wiki/concepts/one.md', tier_available: true, compiled_at: '2026-08-28T00:00:00.000Z' };
    },
  };
  const resolver = createResolver({ vaultRoot: f.root, vaultName: 'kb-sync', snapshotId: '20260828-000000', tierIndex });
  const listing = resolver.list('viking://kb-sync/wiki/concepts');
  assert.equal(listing.files[0].abstract, '# One');
  assert.equal(listing.files[0].stale, false);
  const metadata = resolver.stat('viking://kb-sync/wiki/concepts/one.md');
  assert.equal(metadata.tiers.L0.available, true);
  assert.equal(metadata.tiers.L0.stale, false);
  assert.equal(metadata.tiers.L1.available, false);
  assert.equal(metadata.tiers.L2.available, true);
});

test('batch reads pin one snapshot and isolate per-item errors', async () => {
  const f = fixture();
  const server = createServer(createResolver({ vaultRoot: f.root, vaultName: 'kb-sync', snapshotId: '20260828-000000' }));
  const response = await server.handle({ method: 'viking/readBatch', params: { items: [
    { uri: 'viking://kb-sync/sources/one.js', resolution_tier: 'L2' },
    { uri: 'viking://kb-sync/sources/missing.js', resolution_tier: 'L2' },
  ] } });
  assert.equal(response.snapshot_id, '20260828-000000');
  assert.equal(response.results[0].result.content, 'export const one = 1;');
  assert.equal(response.results[1].error.data.viking_code, 'RESOURCE_NOT_FOUND');
});

test('batch reads enforce the aggregate response byte cap per item', async () => {
  const f = fixture();
  const server = createServer(
    createResolver({ vaultRoot: f.root, vaultName: 'kb-sync', snapshotId: '20260828-000000' }),
    { maxBatchBytes: 5 },
  );
  const response = await server.handle({ method: 'viking/readBatch', params: { items: [
    { uri: 'viking://kb-sync/sources/one.js', resolution_tier: 'L2' },
  ] } });
  assert.equal(response.results.length, 1);
  assert.equal(response.results[0].error.code, JSON_RPC_CODES.RESOURCE_LIMIT);
  assert.equal(response.results[0].error.data.viking_code, 'BATCH_LIMIT_EXCEEDED');
});

test('validates wire requests and returns parse and parameter errors without throwing', async () => {
  const f = fixture();
  const server = createServer(createResolver({ vaultRoot: f.root, vaultName: 'kb-sync', snapshotId: '20260828-000000' }));
  const parseError = await processJsonRpcLine('{', server);
  assert.equal(parseError.error.code, JSON_RPC_CODES.PARSE_ERROR);
  const paramsError = await processJsonRpcLine(JSON.stringify({ jsonrpc: '2.0', id: 7, method: 'resources/list', params: { offset: 0 } }), server);
  assert.equal(paramsError.error.code, JSON_RPC_CODES.INVALID_PARAMS);
  const initialized = await processJsonRpcLine(JSON.stringify({ jsonrpc: '2.0', id: 8, method: 'initialize', params: {} }), server);
  assert.equal(initialized.result.protocolVersion, '2025-06-18');
});
