import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createResolver } from '../../mcp/viking-resolver.mjs';
import { createServer, processJsonRpcLine } from '../../mcp/viking-vfs-server.mjs';
import { createStdioTransport, VikingClient, VikingRpcError, VikingTelemetryTracker, formatVikingUri, parseVikingUri } from '../src/index.mjs';

function fixture({ stale = true, includeL1 = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'viking-client-'));
  const snapshotId = '20260830-010000';
  const snapshot = path.join(root, '_kb-sync-staging', snapshotId);
  fs.mkdirSync(path.join(snapshot, 'sources'), { recursive: true });
  fs.mkdirSync(path.join(snapshot, 'wiki'), { recursive: true });
  fs.mkdirSync(path.join(snapshot, 'schema'), { recursive: true });
  const source = 'export const answer = 42;';
  const overview = '# Answer module\nExports answer.';
  fs.writeFileSync(path.join(snapshot, 'sources', 'answer.js'), source);
  fs.writeFileSync(path.join(snapshot, 'wiki', 'answer.md'), overview);
  fs.writeFileSync(path.join(snapshot, 'FILES.manifest.txt'), 'sources/answer.js\nwiki/answer.md');
  const sourceHash = crypto.createHash('sha256').update(source).digest('hex');
  const tierHash = crypto.createHash('sha256').update(overview).digest('hex');
  const uri = 'viking://kb-sync/sources/answer.js';
  const tierIndex = {
    get(id, resourceUri, tier) {
      if (!includeL1 || tier !== 'L1' || resourceUri !== uri) return null;
      return { snapshot_id: id, uri: resourceUri, tier, source_hash: stale ? 'stale-source-hash' : sourceHash, tier_hash: tierHash, artifact: 'wiki/answer.md', tier_available: true, compiled_at: '2026-08-30T00:00:00.000Z' };
    },
  };
  const resolver = createResolver({ vaultRoot: root, vaultName: 'kb-sync', snapshotId, tierIndex });
  return { root, resolver, uri };
}

function loopbackTransport(server) {
  let id = 0;
  return {
    async request(method, params) {
      const response = await processJsonRpcLine(JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }), server);
      if (response.error) throw new VikingRpcError(response.error);
      return response.result;
    },
    async close() {},
  };
}

test('parses and formats canonical Viking URIs and rejects traversal', () => {
  assert.deepEqual(parseVikingUri('viking://kb-sync/wiki/concepts/one.md'), {
    vault: 'kb-sync', layer: 'wiki', relativePath: 'concepts/one.md', uri: 'viking://kb-sync/wiki/concepts/one.md',
  });
  assert.equal(formatVikingUri({ vault: 'kb-sync', layer: 'sources', relativePath: 'space name.ts' }), 'viking://kb-sync/sources/space%20name.ts');
  assert.throws(() => parseVikingUri('viking://kb-sync/wiki/%2e%2e/secrets'), /unsafe path/);
});

test('P0 and P1 stale L1 reads escalate to immutable L2', async () => {
  const f = fixture({ stale: true });
  const telemetry = new VikingTelemetryTracker();
  const client = new VikingClient({ transport: loopbackTransport(createServer(f.resolver)), telemetry, tokenCounter: (content) => content.split(/\s+/).length });
  await client.connect();
  const value = await client.readWithPolicy(f.uri, { severity: 'P1' });
  assert.equal(value.requestedTier, 'L1');
  assert.equal(value.resolvedTier, 'L2');
  assert.equal(value.fallbackReason, 'STALE_HIGH_SEVERITY');
  assert.equal(value.content, 'export const answer = 42;');
  assert.equal(telemetry.snapshot().resource_read_count, 2);
  assert.equal(telemetry.snapshot().l2_read_count, 1);
  assert.ok(telemetry.snapshot().content_tokens > 0);
});

test('P2 stale L1 reads retain overview with a structured warning', async () => {
  const f = fixture({ stale: true });
  const client = new VikingClient({ transport: loopbackTransport(createServer(f.resolver)) });
  const value = await client.readWithPolicy(f.uri, { severity: 'P2' });
  assert.equal(value.resolvedTier, 'L1');
  assert.equal(value.escalated, false);
  assert.equal(value.warnings[0].code, 'STALE_TIER');
});

test('unavailable L1 transparently falls back to L2 with explicit metadata', async () => {
  const f = fixture({ includeL1: false });
  const client = new VikingClient({ transport: loopbackTransport(createServer(f.resolver)) });
  const value = await client.readWithPolicy(f.uri, { severity: 'P3' });
  assert.equal(value.resolvedTier, 'L2');
  assert.equal(value.fallbackReason, 'TIER_UNAVAILABLE');
  assert.equal(value.escalated, true);
});

test('batchRead uses one RPC and normalizes per-item errors', async () => {
  const f = fixture();
  const telemetry = new VikingTelemetryTracker();
  const client = new VikingClient({ transport: loopbackTransport(createServer(f.resolver)), telemetry });
  const value = await client.batchRead([
    { uri: f.uri, tier: 'L2' },
    { uri: 'viking://kb-sync/sources/missing.js', tier: 'L2' },
  ]);
  assert.equal(value.results[0].ok, true);
  assert.equal(value.results[1].ok, false);
  assert.equal(value.results[1].error.vikingCode, 'RESOURCE_NOT_FOUND');
  assert.equal(telemetry.snapshot().rpc_call_count, 1);
  assert.equal(telemetry.snapshot().resource_read_count, 2);
});

test('stdio transport performs initialize and snapshot-backed L2 read', async (t) => {
  const f = fixture({ includeL1: false });
  const serverPath = path.resolve('../mcp/viking-vfs-server.mjs');
  const transport = createStdioTransport({
    command: process.execPath,
    args: [serverPath],
    cwd: path.resolve('../..'),
    env: { VIKING_VAULT_ROOT: f.root, VIKING_VAULT_NAME: 'kb-sync', VIKING_SNAPSHOT_ID: f.resolver.snapshotId },
    timeoutMs: 5000,
  });
  const client = new VikingClient({ transport });
  t.after(() => client.close());
  await client.connect();
  const value = await client.read(f.uri, 'L2');
  assert.equal(value.snapshot_id, f.resolver.snapshotId);
  assert.equal(value.content, 'export const answer = 42;');
});

