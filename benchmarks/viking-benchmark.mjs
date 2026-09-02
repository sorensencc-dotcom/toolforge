import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { createResolver } from '../modules/mcp/viking-resolver.mjs';
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'viking-benchmark-'));
const snapshot = path.join(root, '_kb-sync-staging', '20260828-000000');
fs.mkdirSync(path.join(snapshot, 'wiki'), { recursive: true });
const source = '# benchmark\n'.repeat(32);
const l0 = 'benchmark summary'; const l1 = `${source}\nL1`;
fs.writeFileSync(path.join(snapshot, 'wiki', 'sample.md'), source);
fs.writeFileSync(path.join(snapshot, 'wiki', 'sample.l0'), l0);
fs.writeFileSync(path.join(snapshot, 'wiki', 'sample.l1'), l1);
fs.writeFileSync(path.join(snapshot, 'FILES.manifest.txt'), 'wiki/sample.md\nwiki/sample.l0\nwiki/sample.l1\n');
const hash = (v) => crypto.createHash('sha256').update(v).digest('hex');
const uri = 'viking://kb-sync/wiki/sample.md';
const resolver = createResolver({ vaultRoot: root, vaultName: 'kb-sync', snapshotId: '20260828-000000', tierIndex: {
  [`${uri}:L0`]: { snapshot_id: '20260828-000000', source_hash: hash(source), tier_hash: hash(l0), artifact: 'wiki/sample.l0', source_path: 'wiki/sample.md', tier_available: true, category: 'benchmark' },
  [`${uri}:L1`]: { snapshot_id: '20260828-000000', source_hash: hash(source), tier_hash: hash(l1), artifact: 'wiki/sample.l1', source_path: 'wiki/sample.md', tier_available: true, category: 'benchmark' },
} });
function measure(label, tier, iterations = 100) { const samples = []; let last; for (let i = 0; i < iterations; i++) { const start = performance.now(); last = resolver.read(uri, tier); samples.push(performance.now() - start); } samples.sort((a, b) => a - b); return { label, tier, iterations, payload_bytes: Buffer.byteLength(last.content), cache_hits: last.cache_hit ? iterations - 1 : 0, p50_ms: samples[50], p95_ms: samples[95] }; }
console.log(JSON.stringify({ generated_at: new Date().toISOString(), artifact: 'benchmark-only', results: [measure('tier read', 'L0'), measure('tier read', 'L1'), measure('raw snapshot read', 'L2')] }, null, 2));