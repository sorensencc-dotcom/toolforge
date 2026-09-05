import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createResolver, VikingError } from './viking-resolver.mjs';
import { createServer, JSON_RPC_CODES } from './viking-vfs-server.mjs';
import {
  validateReport,
  computeVikingReport,
  formatReportMarkdown,
  ContractValidationError,
} from './viking-vfs-contracts.mjs';

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'viking-rep-'));
  const snapshot = path.join(root, '_kb-sync-staging', '20260828-000000');
  fs.mkdirSync(path.join(snapshot, 'wiki', 'concepts'), { recursive: true });
  fs.mkdirSync(path.join(snapshot, 'sources'), { recursive: true });
  fs.writeFileSync(path.join(snapshot, 'wiki', 'concepts', 'report.md'), '# Report Spec\nDetails on reporting.');
  fs.writeFileSync(path.join(snapshot, 'sources', 'report.js'), 'export function runReport() { return 42; }\n'.repeat(20));
  fs.writeFileSync(path.join(snapshot, 'FILES.manifest.txt'), 'wiki/concepts/report.md\nsources/report.js');
  return { root, snapshot };
}

test('validateReport enforces schema and rejects unknown fields', () => {
  const validReport = {
    tier: 'L1',
    uri: 'viking://kb-sync/wiki/concepts/report.md',
    tokens_loaded: 288,
    tokens_saved_vs_L2: 271,
    percent_reduction: 48.5,
    cache_effect: 'preserved',
    mode_choice_correct: true,
    context_window_pressure: {
      current_tokens: 20000,
      usage_pct: 10.0,
      risk_level: 'low',
    },
    model_tier_suitability: 'optimal',
    roundtrip_avoidance_score: 0,
    latency_estimate_ms: 42,
  };

  assert.deepEqual(validateReport(validReport), validReport);

  // Rejects invalid tier
  assert.throws(() => validateReport({ ...validReport, tier: 'L3' }), (err) => err instanceof ContractValidationError);

  // Rejects out-of-bounds percent reduction
  assert.throws(() => validateReport({ ...validReport, percent_reduction: 150.0 }), (err) => err instanceof ContractValidationError);

  // Rejects invalid cache effect
  assert.throws(() => validateReport({ ...validReport, cache_effect: 'busted' }), (err) => err instanceof ContractValidationError);

  // Rejects invalid risk level
  assert.throws(() => validateReport({
    ...validReport,
    context_window_pressure: { usage_pct: 50, risk_level: 'extreme' },
  }), (err) => err instanceof ContractValidationError);

  // Rejects unknown extra properties
  assert.throws(() => validateReport({ ...validReport, extra_noise: true }), (err) => err instanceof ContractValidationError);
});

test('computeVikingReport calculates accurate token deltas and mode alignment', () => {
  const l0Report = computeVikingReport({
    tier: 'L0',
    uri: 'viking://kb-sync/wiki/concepts/report.md',
    content: 'Abstract overview',
    mode: 'exploration',
  });

  assert.equal(l0Report.tier, 'L0');
  assert.ok(l0Report.tokens_saved_vs_L2 > 0);
  assert.ok(l0Report.percent_reduction > 80.0);
  assert.equal(l0Report.mode_choice_correct, true);
  assert.equal(l0Report.cache_effect, 'extended');

  const refactorMismatch = computeVikingReport({
    tier: 'L0',
    uri: 'viking://kb-sync/wiki/concepts/report.md',
    content: 'Abstract overview',
    mode: 'refactor',
  });
  assert.equal(refactorMismatch.mode_choice_correct, false);
});

test('formatReportMarkdown outputs standard markdown table', () => {
  const report = computeVikingReport({
    tier: 'L1',
    uri: 'viking://kb-sync/wiki/concepts/report.md',
    content: 'Semantic summary markdown',
    cacheHit: true,
  });

  const md = formatReportMarkdown(report);
  assert.ok(md.includes('<!-- viking://report -->'));
  assert.ok(md.includes('| Tier / URI | `L1`'));
  assert.ok(md.includes('Deterministic'));
});

test('server attaches validated report and formats markdown on read/stat/list', async () => {
  const f = fixture();
  const resolver = createResolver({ vaultRoot: f.root, vaultName: 'kb-sync', snapshotId: '20260828-000000' });
  const server = createServer(resolver);

  const readRes = await server.handle({
    method: 'viking/read',
    params: { uri: 'viking://kb-sync/sources/report.js', resolution_tier: 'L2', mode: 'refactor' },
  });

  assert.ok(readRes.report);
  assert.equal(readRes.report.tier, 'L2');
  assert.equal(readRes.report.mode_choice_correct, true);
  assert.ok(readRes.markdown_report.includes('<!-- viking://report -->'));

  const statRes = await server.handle({
    method: 'viking/stat',
    params: { uri: 'viking://kb-sync/sources/report.js' },
  });
  assert.ok(statRes.report);
  assert.equal(statRes.report.tier, 'L0');

  const listRes = await server.handle({
    method: 'viking/list',
    params: { uri: 'viking://kb-sync/sources' },
  });
  assert.ok(listRes.report);
  assert.equal(listRes.report.tier, 'L0');
});

test('server protocolCode maps VIKING_REPORT_INVALID to code -32005', async () => {
  assert.equal(JSON_RPC_CODES.VIKING_REPORT_INVALID, -32005);
});
