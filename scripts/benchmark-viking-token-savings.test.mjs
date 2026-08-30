import assert from 'node:assert/strict';
import test from 'node:test';

import {
  STANDARD_SCENARIOS,
  renderDailyStatusDelta,
  runVikingTokenBenchmark,
  updateDailyStatus,
} from './benchmark-viking-token-savings.mjs';

test('defines the five standardized exploration scenarios', () => {
  assert.deepEqual(
    STANDARD_SCENARIOS.map(({ id }) => id),
    [
      'ci-defect-triage',
      'module-relationship-mapping',
      'contract-enum-validation',
      'wiki-autoheal-scan',
      'full-feature-audit',
    ],
  );
});

test('runs both modes, aggregates medians, and calculates L2 escalation rate', async () => {
  const scenarios = [STANDARD_SCENARIOS[0]];
  const samples = {
    baseline: [1000, 1100, 900],
    viking: [300, 350, 250],
  };

  const report = await runVikingTokenBenchmark({
    scenarios,
    repetitions: 3,
    execute: async ({ mode, repetition, scenario }) => ({
      total_input_tokens: samples[mode][repetition],
      total_output_tokens: mode === 'baseline' ? 200 : 150,
      wall_clock_time_ms: mode === 'baseline' ? 100 : 130,
      rpc_call_count: mode === 'baseline' ? 2 : 6,
      resource_read_count: 10,
      l2_read_count: mode === 'baseline' ? 10 : 2,
      outcome_fingerprint: `${scenario.id}-same-result`,
      tokenizer: { name: 'production-tokenizer', exact: true },
    }),
  });

  assert.equal(report.scenarios[0].baseline.total_input_tokens, 1000);
  assert.equal(report.scenarios[0].viking.total_input_tokens, 300);
  assert.equal(report.scenarios[0].delta.input_token_reduction_percent, 70);
  assert.equal(report.scenarios[0].viking.l2_escalation_rate_percent, 20);
  assert.equal(report.summary.input_token_reduction_percent, 70);
  assert.equal(report.summary.l2_escalation_rate_percent, 20);
  assert.equal(report.publication_eligible, true);
});

test('rejects comparisons whose outcomes do not match', async () => {
  await assert.rejects(
    runVikingTokenBenchmark({
      scenarios: [STANDARD_SCENARIOS[0]],
      repetitions: 1,
      execute: async ({ mode }) => ({
        total_input_tokens: 10,
        total_output_tokens: 5,
        wall_clock_time_ms: 1,
        rpc_call_count: 1,
        resource_read_count: 1,
        l2_read_count: mode === 'baseline' ? 1 : 0,
        outcome_fingerprint: mode,
        tokenizer: { name: 'production-tokenizer', exact: true },
      }),
    }),
    /outcome fingerprint/i,
  );
});

test('marks estimated token counts as ineligible for publication', async () => {
  const report = await runVikingTokenBenchmark({
    scenarios: [STANDARD_SCENARIOS[0]],
    repetitions: 1,
    execute: async ({ scenario }) => ({
      total_input_tokens: 10,
      total_output_tokens: 5,
      wall_clock_time_ms: 1,
      rpc_call_count: 1,
      resource_read_count: 1,
      l2_read_count: 0,
      outcome_fingerprint: scenario.id,
      tokenizer: { name: 'heuristic', exact: false },
    }),
  });

  assert.equal(report.publication_eligible, false);
  assert.match(report.publication_blockers.join(' '), /exact tokenizer/i);
});

test('renders and idempotently updates the daily status benchmark section', () => {
  const report = {
    generated_at: '2026-08-30T12:00:00.000Z',
    repetitions: 3,
    publication_eligible: true,
    summary: {
      total_input_tokens: { baseline: 1000, viking: 300 },
      input_token_reduction_percent: 70,
      wall_clock_time_ms: { baseline: 100, viking: 130 },
      rpc_call_count: { baseline: 2, viking: 6 },
      l2_escalation_rate_percent: 20,
    },
  };

  const section = renderDailyStatusDelta(report);
  assert.match(section, /70\.00%/);
  assert.match(section, /20\.00%/);

  const once = updateDailyStatus('# Daily\n', report);
  const twice = updateDailyStatus(once, report);
  assert.equal(twice, once);
  assert.equal((twice.match(/VIKING_BENCHMARK_START/g) ?? []).length, 1);
});
