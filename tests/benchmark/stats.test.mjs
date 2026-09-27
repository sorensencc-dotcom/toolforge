import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateDistribution, computeGateThreshold, evaluateRegression } from '../../src/benchmark/stats.mjs';

describe('Performance Statistics & Gate Calculations', () => {
  it('calculates distribution metrics accurately', () => {
    const samples = [10.0, 10.2, 10.5, 10.1, 10.3, 10.4, 10.2, 10.1, 10.6, 10.3, 10.2, 10.1];
    const metrics = calculateDistribution(samples);
    assert.equal(metrics.sampleCount, 12);
    assert.equal(Math.round(metrics.p50Ms * 10) / 10, 10.2);
    assert.equal(metrics.minMs, 10.0);
    assert.equal(metrics.maxMs, 10.6);
    assert.ok(metrics.iqrMs >= 0);
  });

  it('handles odd sample sizes and empty input validation', () => {
    const oddSamples = [5.0, 1.0, 3.0];
    const oddMetrics = calculateDistribution(oddSamples);
    assert.equal(oddMetrics.sampleCount, 3);
    assert.equal(oddMetrics.p50Ms, 3.0);
    assert.equal(oddMetrics.minMs, 1.0);
    assert.equal(oddMetrics.maxMs, 5.0);

    assert.throws(() => calculateDistribution([]), /Samples array must not be empty\./);
    assert.throws(() => calculateDistribution(null), /Samples array must not be empty\./);
  });

  it('computes gate threshold with 1.35x multiplier and adaptive floor', () => {
    // 100ms baseline: 100 * 1.35 + max(5, 5) = 135 + 5 = 140ms
    const threshold100 = computeGateThreshold(100, 500);
    assert.equal(threshold100, 140);

    // Enforces ceiling limit
    const thresholdCapped = computeGateThreshold(400, 450);
    assert.equal(thresholdCapped, 450);
  });

  it('evaluates regression states correctly', () => {
    assert.equal(evaluateRegression(120, 100, 500), 'PASS'); // Under 140ms gate
    assert.equal(evaluateRegression(150, 100, 500), 'FAIL'); // Exceeds 140ms gate
    assert.equal(evaluateRegression(60, 100, 500), 'IMPROVEMENT'); // Under 0.70x baseline
  });
});
