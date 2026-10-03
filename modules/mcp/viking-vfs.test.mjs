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

test('lists vfs_upsert_document tool and handles tools/call write-through', async () => {
  const f = fixture();
  const server = createServer(
    createResolver({ vaultRoot: f.root, vaultName: 'kb-sync', snapshotId: '20260828-000000' }),
    { repoRoot: f.root }
  );

  const initRes = await server.handle({ method: 'initialize', params: {} });
  assert.ok(initRes.capabilities.tools);

  const listRes = await server.handle({ method: 'tools/list', params: {} });
  assert.ok(Array.isArray(listRes.tools));
  assert.ok(listRes.tools.some((t) => t.name === 'vfs_upsert_document'));

  const content = '# Dynamic Research Note\n\nCreated via Viking VFS MCP write-through.';
  const callRes = await server.handle({
    method: 'tools/call',
    params: {
      name: 'vfs_upsert_document',
      arguments: {
        topic: 'viking-write-test',
        category: 'research',
        content,
      },
    },
  });

  assert.ok(!callRes.error);
  assert.ok(Array.isArray(callRes.content));
  const payload = JSON.parse(callRes.content[0].text);
  assert.equal(payload.ok, true);
  assert.equal(payload.file_path, 'wiki/research/viking-write-test.md');

  const written = path.join(f.root, 'wiki', 'research', 'viking-write-test.md');
  assert.ok(fs.existsSync(written));
  assert.equal(fs.readFileSync(written, 'utf8'), content);
});

test('vfs_upsert_document rejects path traversal and absolute paths', async () => {
  const f = fixture();
  const server = createServer(
    createResolver({ vaultRoot: f.root, vaultName: 'kb-sync', snapshotId: '20260828-000000' }),
    { repoRoot: f.root }
  );

  const traversalRes = await server.handle({
    method: 'tools/call',
    params: {
      name: 'vfs_upsert_document',
      arguments: {
        topic: 'evil',
        category: 'research',
        content: 'test',
        file_path: '../../../etc/passwd',
      },
    },
  });
  assert.equal(traversalRes.error.code, JSON_RPC_CODES.INVALID_PARAMS);
  assert.equal(traversalRes.error.data.viking_code, 'PATH_TRAVERSAL_REJECTED');

  const absRes = await server.handle({
    method: 'tools/call',
    params: {
      name: 'vfs_upsert_document',
      arguments: {
        topic: 'evil',
        category: 'research',
        content: 'test',
        file_path: '/absolute/path.md',
      },
    },
  });
  assert.equal(absRes.error.code, JSON_RPC_CODES.INVALID_PARAMS);
  assert.equal(absRes.error.data.viking_code, 'PATH_TRAVERSAL_REJECTED');
});

test('MCP server exposes canonical tools and compatibility tool aliases in tools/list', async () => {
  const f = fixture();
  const server = createServer(createResolver({ vaultRoot: f.root, vaultName: 'kb-sync', snapshotId: '20260828-000000' }));
  const response = await server.handle({ method: 'tools/list', params: {} });
  assert.ok(Array.isArray(response.tools));
  const toolNames = response.tools.map((t) => t.name);

  // Canonical tools
  assert.ok(toolNames.includes('vfs_upsert_document'));
  assert.ok(toolNames.includes('viking_list'));
  assert.ok(toolNames.includes('viking_stat'));
  assert.ok(toolNames.includes('viking_read'));
  assert.ok(toolNames.includes('viking_read_batch'));
  assert.ok(toolNames.includes('viking_report'));
  assert.ok(toolNames.includes('resources/list'));
  assert.ok(toolNames.includes('resources/read'));

  // Compatibility aliases
  assert.ok(toolNames.includes('viking_ls'));
  assert.ok(toolNames.includes('viking_overview'));
  assert.ok(toolNames.includes('viking_read_detail'));
});

test('tools/call executes compatibility tool aliases correctly for L0, L1, and L2', async () => {
  const f = fixture();
  const content = fs.readFileSync(path.join(f.snapshot, 'wiki', 'concepts', 'one.md'), 'utf8');
  const hash = crypto.createHash('sha256').update(content).digest('hex');
  const tierIndex = {
    get(snapshotId, resourceUri, tier) {
      if (resourceUri !== 'viking://kb-sync/wiki/concepts/one.md') return null;
      if (tier === 'L0') return { snapshot_id: snapshotId, uri: resourceUri, tier: 'L0', source_hash: hash, tier_hash: hash, artifact: 'wiki/concepts/one.md', tier_available: true, compiled_at: '2026-08-28T00:00:00.000Z' };
      if (tier === 'L1') return { snapshot_id: snapshotId, uri: resourceUri, tier: 'L1', source_hash: hash, tier_hash: hash, artifact: 'wiki/concepts/one.md', tier_available: true, compiled_at: '2026-08-28T00:00:00.000Z' };
      return null;
    },
  };
  const resolver = createResolver({ vaultRoot: f.root, vaultName: 'kb-sync', snapshotId: '20260828-000000', tierIndex });
  const server = createServer(resolver);

  // viking_ls -> maps to viking/list (returns L0 abstract in listing)
  const lsRes = await server.handle({
    method: 'tools/call',
    params: {
      name: 'viking_ls',
      arguments: { uri: 'viking://kb-sync/wiki/concepts' },
    },
  });
  assert.ok(!lsRes.error);
  const lsData = JSON.parse(lsRes.content[0].text);
  assert.equal(lsData.files[0].name, 'one.md');
  assert.equal(lsData.files[0].abstract, '# One');

  // viking_overview -> maps to viking/read with default resolution_tier: L1
  const overviewRes = await server.handle({
    method: 'tools/call',
    params: {
      name: 'viking_overview',
      arguments: { uri: 'viking://kb-sync/wiki/concepts/one.md' },
    },
  });
  assert.ok(!overviewRes.error);
  const overviewData = JSON.parse(overviewRes.content[0].text);
  assert.equal(overviewData.resolution_tier, 'L1');
  assert.equal(overviewData.content, '# One');

  // viking_read_detail -> maps to viking/read with resolution_tier: L2
  const detailRes = await server.handle({
    method: 'tools/call',
    params: {
      name: 'viking_read_detail',
      arguments: { uri: 'viking://kb-sync/sources/one.js' },
    },
  });
  assert.ok(!detailRes.error);
  const detailData = JSON.parse(detailRes.content[0].text);
  assert.equal(detailData.resolution_tier, 'L2');
  assert.equal(detailData.content, 'export const one = 1;');
});

test('handles direct JSON-RPC method calls for compatibility aliases (viking_ls, viking_overview, viking_read_detail)', async () => {
  const f = fixture();
  const resolver = createResolver({ vaultRoot: f.root, vaultName: 'kb-sync', snapshotId: '20260828-000000' });
  const server = createServer(resolver);

  const lsRes = await server.handle({ method: 'viking_ls', params: { uri: 'viking://kb-sync/wiki/concepts' } });
  assert.ok(!lsRes.error);
  assert.deepEqual(lsRes.files.map((x) => x.name), ['one.md']);

  const detailRes = await server.handle({ method: 'viking_read_detail', params: { uri: 'viking://kb-sync/sources/one.js' } });
  assert.ok(!detailRes.error);
  assert.equal(detailRes.resolution_tier, 'L2');
  assert.equal(detailRes.content, 'export const one = 1;');
});

test('enforces read-only governance when readOnly is configured', async () => {
  const f = fixture();
  const server = createServer(
    createResolver({ vaultRoot: f.root, vaultName: 'kb-sync', snapshotId: '20260828-000000' }),
    { repoRoot: f.root, readOnly: true }
  );

  const toolCallRes = await server.handle({
    method: 'tools/call',
    params: {
      name: 'vfs_upsert_document',
      arguments: {
        topic: 'blocked',
        category: 'research',
        content: 'should fail',
      },
    },
  });
  assert.equal(toolCallRes.error.code, JSON_RPC_CODES.READONLY_VIOLATION);
  assert.equal(toolCallRes.error.data.viking_code, 'READONLY_VIOLATION');

  const directRes = await server.handle({
    method: 'viking/upsertDocument',
    params: {
      topic: 'blocked',
      category: 'research',
      content: 'should fail',
    },
  });
  assert.equal(directRes.error.code, JSON_RPC_CODES.READONLY_VIOLATION);
  assert.equal(directRes.error.data.viking_code, 'READONLY_VIOLATION');

  // Read operations remain completely functional
  const readRes = await server.handle({ method: 'viking/read', params: { uri: 'viking://kb-sync/sources/one.js', resolution_tier: 'L2' } });
  assert.ok(!readRes.error);
  assert.equal(readRes.content, 'export const one = 1;');
});


