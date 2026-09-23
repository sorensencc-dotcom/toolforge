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
const BYTES_PER_TOKEN = 4.0;
const PRICING_PER_MILLION_INPUT = {
  claude_3_5_sonnet: 3.00,
  gemini_1_5_pro: 1.25,
  gpt_4o: 2.50,
};

function measure(label, tier, iterations = 100) {
  const samples = [];
  let last;
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    last = resolver.read(uri, tier);
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  const payloadBytes = Buffer.byteLength(last.content);
  const estimatedTokens = Math.ceil(payloadBytes / BYTES_PER_TOKEN);

  return {
    label,
    tier,
    iterations,
    payload_bytes: payloadBytes,
    estimated_tokens: estimatedTokens,
    cache_hits: last.cache_hit ? iterations - 1 : 0,
    p50_ms: Number(samples[Math.floor(iterations * 0.5)].toFixed(4)),
    p95_ms: Number(samples[Math.floor(iterations * 0.95)].toFixed(4)),
  };
}

const results = [
  measure('tier read', 'L0'),
  measure('tier read', 'L1'),
  measure('raw snapshot read', 'L2'),
];

const l2Result = results.find((r) => r.tier === 'L2') || results[2];
const baselineTokens = l2Result.estimated_tokens;

const enrichedResults = results.map((res) => {
  const tokensSavedPerCall = Math.max(0, baselineTokens - res.estimated_tokens);
  const reductionPct = Number(((tokensSavedPerCall / (baselineTokens || 1)) * 100).toFixed(2));
  const scale10k = tokensSavedPerCall * 10_000;

  return {
    ...res,
    telemetry: {
      tokens_saved_per_call: tokensSavedPerCall,
      token_reduction_pct: reductionPct,
      projected_cost_avoidance_usd_per_10k_calls: {
        claude_3_5_sonnet: Number(((scale10k / 1_000_000) * PRICING_PER_MILLION_INPUT.claude_3_5_sonnet).toFixed(4)),
        gemini_1_5_pro: Number(((scale10k / 1_000_000) * PRICING_PER_MILLION_INPUT.gemini_1_5_pro).toFixed(4)),
        gpt_4o: Number(((scale10k / 1_000_000) * PRICING_PER_MILLION_INPUT.gpt_4o).toFixed(4)),
      },
    },
  };
});

console.log(
  JSON.stringify(
    {
      generated_at: new Date().toISOString(),
      artifact: 'vfs-tier-benchmark-telemetry',
      baseline_tier: 'L2',
      pricing_reference_per_1m: PRICING_PER_MILLION_INPUT,
      results: enrichedResults,
    },
    null,
    2,
  ),
);