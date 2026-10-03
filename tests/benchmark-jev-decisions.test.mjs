import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateBoundedDecisionSchema,
  calculateBrierScore,
  calculateLogLoss,
  calculateExpectedCalibrationError,
  calculateLatencyMetrics,
  calculateCostEfficiency,
  evaluateEscalationPolicy,
  runBenchmarkSuite,
  JEV_COST_PER_MILLION,
  FRONTIER_LLM_COST_PER_MILLION
} from '../scripts/benchmark-jev-decisions.mjs';

test('validateBoundedDecisionSchema enforces strict bounded contracts for verify', () => {
  const valid = validateBoundedDecisionSchema('verify', { decision: true, confidence: 0.95 });
  assert.equal(valid.valid, true);

  const invalidType = validateBoundedDecisionSchema('verify', { decision: 'yes', confidence: 0.95 });
  assert.equal(invalidType.valid, false);
  assert.match(invalidType.error, /boolean decision/);

  const invalidConf = validateBoundedDecisionSchema('verify', { decision: true, confidence: 1.5 });
  assert.equal(invalidConf.valid, false);
  assert.match(invalidConf.error, /between 0 and 1/);
});

test('validateBoundedDecisionSchema enforces strict bounded contracts for screen and find', () => {
  const validScreen = validateBoundedDecisionSchema('screen', { passed: true, score: 0.82 });
  assert.equal(validScreen.valid, true);

  const invalidScreen = validateBoundedDecisionSchema('screen', { passed: 'true', score: 0.82 });
  assert.equal(invalidScreen.valid, false);

  const validFind = validateBoundedDecisionSchema('find', { selected_index: 2, confidence: 0.91 });
  assert.equal(validFind.valid, true);

  const invalidFind = validateBoundedDecisionSchema('find', { selected_index: -1, confidence: 0.91 });
  assert.equal(invalidFind.valid, false);
  assert.match(invalidFind.error, /non-negative integer/);
});

test('validateBoundedDecisionSchema enforces discrete choice sets and probability sums for decide', () => {
  const validDecide = validateBoundedDecisionSchema(
    'decide',
    {
      choice: 'INGEST_DOCUMENT',
      chosen_probability: 0.85,
      probabilities: { INGEST_DOCUMENT: 0.85, REJECT_DUPLICATE: 0.15 }
    },
    ['INGEST_DOCUMENT', 'REJECT_DUPLICATE', 'ESCALATE_REVIEW']
  );
  assert.equal(validDecide.valid, true);

  const invalidChoice = validateBoundedDecisionSchema(
    'decide',
    {
      choice: 'HALLUCINATED_ACTION',
      chosen_probability: 0.85,
      probabilities: { HALLUCINATED_ACTION: 1.0 }
    },
    ['INGEST_DOCUMENT', 'REJECT_DUPLICATE']
  );
  assert.equal(invalidChoice.valid, false);
  assert.match(invalidChoice.error, /not in allowed discrete set/);

  const invalidSum = validateBoundedDecisionSchema(
    'decide',
    {
      choice: 'INGEST_DOCUMENT',
      chosen_probability: 0.6,
      probabilities: { INGEST_DOCUMENT: 0.6, REJECT_DUPLICATE: 0.8 }
    },
    ['INGEST_DOCUMENT', 'REJECT_DUPLICATE']
  );
  assert.equal(invalidSum.valid, false);
  assert.match(invalidSum.error, /probabilities must sum to 1.0/);
});

test('calculateBrierScore computes exact calibration loss', () => {
  // Perfect predictions: prob=1 when true, prob=0 when false -> brier = 0
  const perfect = [
    { probability: 1.0, actual: true },
    { probability: 0.0, actual: false }
  ];
  assert.equal(calculateBrierScore(perfect), 0);

  // Worst predictions: prob=0 when true, prob=1 when false -> brier = 1
  const worst = [
    { probability: 0.0, actual: true },
    { probability: 1.0, actual: false }
  ];
  assert.equal(calculateBrierScore(worst), 1.0);

  // Mixed realistic predictions: (0.9-1)^2 = 0.01, (0.2-0)^2 = 0.04 -> mean = 0.025
  const realistic = [
    { probability: 0.9, actual: true },
    { probability: 0.2, actual: false }
  ];
  assert.equal(calculateBrierScore(realistic), 0.025);

  assert.throws(() => calculateBrierScore([]), /must not be empty/);
});

test('calculateLogLoss computes binary cross entropy with epsilon clamping', () => {
  const confidentGood = [
    { probability: 0.99, actual: true },
    { probability: 0.01, actual: false }
  ];
  const lossGood = calculateLogLoss(confidentGood);
  assert.ok(lossGood < 0.02);

  const confidentBad = [
    { probability: 0.01, actual: true },
    { probability: 0.99, actual: false }
  ];
  const lossBad = calculateLogLoss(confidentBad);
  assert.ok(lossBad > 4.0);
});

test('calculateExpectedCalibrationError quantifies reliability gap across probability bins', () => {
  // Well-calibrated items
  const calibrated = [
    { probability: 0.1, actual: false },
    { probability: 0.1, actual: false },
    { probability: 0.9, actual: true },
    { probability: 0.9, actual: true }
  ];
  const eceCalibrated = calculateExpectedCalibrationError(calibrated, 10);
  assert.ok(eceCalibrated <= 0.1);

  // Overconfident uncalibrated items (claiming 0.9 but actually false)
  const uncalibrated = [
    { probability: 0.9, actual: false },
    { probability: 0.9, actual: false }
  ];
  const eceUncalibrated = calculateExpectedCalibrationError(uncalibrated, 10);
  assert.ok(eceUncalibrated >= 0.8);
});

test('calculateLatencyMetrics measures exact percentiles and summary stats', () => {
  const latencies = [120, 140, 150, 160, 180, 200, 250, 310, 480, 950];
  const metrics = calculateLatencyMetrics(latencies);

  assert.equal(metrics.count, 10);
  assert.equal(metrics.min, 120);
  assert.equal(metrics.max, 950);
  assert.equal(metrics.p50, 200);
  assert.equal(metrics.p90, 950);
  assert.ok(metrics.mean > 250 && metrics.mean < 350);
});

test('calculateCostEfficiency computes comparative token economics and unit cost', () => {
  const cost = calculateCostEfficiency(10000, 120); // 10,000 decisions @ 120 tokens/decision
  assert.equal(cost.decisionCount, 10000);
  assert.equal(cost.totalTokens, 1200000); // 1.2M tokens
  assert.equal(cost.jevCostUsd, 0.0504); // 1.2 * 0.042
  assert.equal(cost.llmCostUsd, 18.0); // 1.2 * 15.00
  assert.ok(cost.savingsFactor > 300);
  assert.ok(cost.costPer1kDecisionsJev < 0.01);
});

test('evaluateEscalationPolicy gates ambiguous confidence into fail-soft escalation', () => {
  // High confidence -> Auto resolve
  const confidentPass = evaluateEscalationPolicy(0.92, 0.40, 0.60);
  assert.equal(confidentPass.escalated, false);
  assert.equal(confidentPass.action, 'AUTO_RESOLVE');

  const confidentReject = evaluateEscalationPolicy(0.15, 0.40, 0.60);
  assert.equal(confidentReject.escalated, false);
  assert.equal(confidentReject.action, 'AUTO_RESOLVE');

  // Ambiguous confidence -> Escalate to frontier
  const ambiguous = evaluateEscalationPolicy(0.52, 0.40, 0.60);
  assert.equal(ambiguous.escalated, true);
  assert.equal(ambiguous.action, 'ESCALATE_TO_FRONTIER');
  assert.match(ambiguous.reason, /Ambiguous confidence level/);
});

test('runBenchmarkSuite executes end-to-end benchmark dataset analysis', () => {
  const dataset = [
    {
      action_type: 'verify',
      output: { decision: true, confidence: 0.96 },
      ground_truth: true,
      latency_ms: 140
    },
    {
      action_type: 'screen',
      output: { passed: true, score: 0.89 },
      ground_truth: true,
      latency_ms: 165
    },
    {
      action_type: 'verify',
      output: { decision: false, confidence: 0.10 },
      ground_truth: false,
      latency_ms: 155
    },
    {
      action_type: 'decide',
      output: {
        choice: 'TRIAGE_HOLD',
        chosen_probability: 0.52,
        probabilities: { TRIAGE_HOLD: 0.52, TRIAGE_PROCEED: 0.48 }
      },
      ground_truth: true,
      latency_ms: 220,
      allowed_choices: ['TRIAGE_HOLD', 'TRIAGE_PROCEED'],
      lower_threshold: 0.40,
      upper_threshold: 0.60
    }
  ];

  const results = runBenchmarkSuite(dataset);

  assert.equal(results.totalItems, 4);
  assert.equal(results.schemaViolations, 0);
  assert.equal(results.schemaConformanceRate, 1.0);
  assert.ok(results.brierScore < 0.1);
  assert.ok(results.latency.p50 <= 200);
  assert.equal(results.escalatedCases, 1);
  assert.equal(results.escalationRate, 0.25);
});
