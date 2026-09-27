/**
 * Calculates statistical distribution from steady-state samples.
 * @param {number[]} samples Array of latency numbers in milliseconds.
 */
export function calculateDistribution(samples) {
  if (!samples || samples.length === 0) {
    throw new Error('Samples array must not be empty.');
  }

  const sorted = [...samples].sort((a, b) => a - b);
  const n = sorted.length;

  const p50Ms = n % 2 === 0 
    ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 
    : sorted[Math.floor(n / 2)];

  const q1 = sorted[Math.floor(n * 0.25)];
  const q3 = sorted[Math.floor(n * 0.75)];
  const iqrMs = q3 - q1;

  const mean = sorted.reduce((sum, val) => sum + val, 0) / n;
  const variance = sorted.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;

  return {
    sampleCount: n,
    p50Ms,
    minMs: sorted[0],
    maxMs: sorted[n - 1],
    iqrMs,
    variance
  };
}

/**
 * Computes the deterministic gate threshold.
 * Formula: min(ceilingMs, p50Baseline * 1.35 + max(5.0, 0.05 * p50Baseline))
 * @param {number} p50Baseline Baseline p50 latency in milliseconds.
 * @param {number} ceilingMs Hard ceiling limit in milliseconds.
 * @returns {number} Allowed threshold in milliseconds.
 */
export function computeGateThreshold(p50Baseline, ceilingMs) {
  const adaptiveFloor = Math.max(5.0, 0.05 * p50Baseline);
  const calculatedThreshold = p50Baseline * 1.35 + adaptiveFloor;
  return Math.min(ceilingMs, calculatedThreshold);
}

/**
 * Evaluates a measured run against the baseline.
 * @param {number} p50Current Measured p50 latency in milliseconds.
 * @param {number} p50Baseline Baseline p50 latency in milliseconds.
 * @param {number} ceilingMs Hard ceiling limit in milliseconds.
 * @returns {'PASS' | 'FAIL' | 'IMPROVEMENT'}
 */
export function evaluateRegression(p50Current, p50Baseline, ceilingMs) {
  const threshold = computeGateThreshold(p50Baseline, ceilingMs);
  if (p50Current > threshold) {
    return 'FAIL';
  }
  if (p50Current < 0.70 * p50Baseline) {
    return 'IMPROVEMENT';
  }
  return 'PASS';
}
