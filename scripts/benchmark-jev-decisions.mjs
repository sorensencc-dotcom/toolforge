/**
 * benchmark-jev-decisions.mjs
 *
 * Benchmark harness & evaluation engine for Jev-style zero-shot probabilistic decision models.
 * Evaluates bounded output constraints, probability calibration (Brier Score, Log-Loss, ECE),
 * latency percentiles, cost efficiencies, and fail-soft ambiguity escalation.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

export const JEV_COST_PER_MILLION = 0.042; // $0.042 / 1M tokens
export const FRONTIER_LLM_COST_PER_MILLION = 15.0; // $15.00 / 1M tokens (e.g. Claude 3.5 Opus / Sonnet blended)

/**
 * Validates discrete bounded schema for decision tasks.
 * Ensures zero-hallucination boundary: output must match strictly typed contracts.
 */
export function validateBoundedDecisionSchema(actionType, output, allowedChoices = []) {
  if (!output || typeof output !== 'object') {
    return { valid: false, error: 'Output must be an object' };
  }

  switch (actionType) {
    case 'verify': {
      const { decision, confidence } = output;
      if (typeof decision !== 'boolean') return { valid: false, error: 'verify requires boolean decision' };
      if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) {
        return { valid: false, error: 'confidence must be a number between 0 and 1' };
      }
      return { valid: true };
    }
    case 'screen': {
      const { passed, score } = output;
      if (typeof passed !== 'boolean') return { valid: false, error: 'screen requires boolean passed flag' };
      if (typeof score !== 'number' || score < 0 || score > 1) {
        return { valid: false, error: 'score must be a number between 0 and 1' };
      }
      return { valid: true };
    }
    case 'find': {
      const { selected_index, confidence } = output;
      if (!Number.isInteger(selected_index) || selected_index < 0) {
        return { valid: false, error: 'selected_index must be non-negative integer' };
      }
      if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) {
        return { valid: false, error: 'confidence must be between 0 and 1' };
      }
      return { valid: true };
    }
    case 'decide': {
      const { choice, probabilities, chosen_probability } = output;
      if (!choice || typeof choice !== 'string') return { valid: false, error: 'decide requires choice string' };
      if (allowedChoices.length > 0 && !allowedChoices.includes(choice)) {
        return { valid: false, error: `choice '${choice}' not in allowed discrete set: ${allowedChoices.join(', ')}` };
      }
      if (probabilities && typeof probabilities === 'object') {
        const sum = Object.values(probabilities).reduce((acc, p) => acc + (typeof p === 'number' ? p : 0), 0);
        if (Math.abs(sum - 1.0) > 0.05) {
          return { valid: false, error: `probabilities must sum to 1.0 (got ${sum.toFixed(3)})` };
        }
      }
      if (typeof chosen_probability !== 'number' || chosen_probability < 0 || chosen_probability > 1) {
        return { valid: false, error: 'chosen_probability must be between 0 and 1' };
      }
      return { valid: true };
    }
    default:
      return { valid: false, error: `Unsupported decision action type: ${actionType}` };
  }
}

/**
 * Calculates Brier Score for binary probabilistic predictions: (1/N) * sum((prob - actual)^2).
 * Lower is better (0 = perfect calibration and accuracy).
 */
export function calculateBrierScore(predictions) {
  if (!Array.isArray(predictions) || predictions.length === 0) {
    throw new Error('predictions array must not be empty');
  }
  let sum = 0;
  for (const item of predictions) {
    const prob = Number(item.probability ?? item.confidence ?? item.score);
    const actual = item.actual ? 1 : 0;
    if (isNaN(prob) || prob < 0 || prob > 1) {
      throw new Error(`Invalid probability value: ${prob}`);
    }
    sum += Math.pow(prob - actual, 2);
  }
  return sum / predictions.length;
}

/**
 * Calculates Log-Loss (Cross-Entropy) for binary probabilities.
 */
export function calculateLogLoss(predictions, eps = 1e-15) {
  if (!Array.isArray(predictions) || predictions.length === 0) {
    throw new Error('predictions array must not be empty');
  }
  let totalLoss = 0;
  for (const item of predictions) {
    const rawProb = Number(item.probability ?? item.confidence ?? item.score);
    const actual = item.actual ? 1 : 0;
    const p = Math.max(eps, Math.min(1 - eps, rawProb));
    const loss = -(actual * Math.log(p) + (1 - actual) * Math.log(1 - p));
    totalLoss += loss;
  }
  return totalLoss / predictions.length;
}

/**
 * Computes Expected Calibration Error (ECE) across specified bins (default: 10).
 */
export function calculateExpectedCalibrationError(predictions, numBins = 10) {
  if (!Array.isArray(predictions) || predictions.length === 0) {
    throw new Error('predictions array must not be empty');
  }

  const bins = Array.from({ length: numBins }, () => ({
    count: 0,
    sumProb: 0,
    sumActual: 0
  }));

  for (const item of predictions) {
    const prob = Number(item.probability ?? item.confidence ?? item.score);
    const actual = item.actual ? 1 : 0;
    let binIdx = Math.floor(prob * numBins);
    if (binIdx >= numBins) binIdx = numBins - 1;

    bins[binIdx].count += 1;
    bins[binIdx].sumProb += prob;
    bins[binIdx].sumActual += actual;
  }

  const totalN = predictions.length;
  let ece = 0;

  for (const bin of bins) {
    if (bin.count > 0) {
      const avgProb = bin.sumProb / bin.count;
      const avgActual = bin.sumActual / bin.count;
      const binWeight = bin.count / totalN;
      ece += binWeight * Math.abs(avgActual - avgProb);
    }
  }

  return ece;
}

/**
 * Calculates latency percentiles (p50, p90, p99, mean, max).
 */
export function calculateLatencyMetrics(latenciesMs) {
  if (!Array.isArray(latenciesMs) || latenciesMs.length === 0) {
    throw new Error('latencies array must not be empty');
  }
  const sorted = [...latenciesMs].sort((a, b) => a - b);
  const n = sorted.length;

  const getPercentile = (p) => {
    const idx = Math.min(n - 1, Math.floor((p / 100) * n));
    return sorted[idx];
  };

  const sum = sorted.reduce((acc, v) => acc + v, 0);

  return {
    count: n,
    p50: getPercentile(50),
    p90: getPercentile(90),
    p99: getPercentile(99),
    mean: Number((sum / n).toFixed(2)),
    min: sorted[0],
    max: sorted[n - 1]
  };
}

/**
 * Computes comparative cost modeling between Jev decision engines and frontier LLM baselines.
 */
export function calculateCostEfficiency(decisionCount, avgTokensPerDecision = 120) {
  const totalTokens = decisionCount * avgTokensPerDecision;
  const jevCost = (totalTokens / 1_000_000) * JEV_COST_PER_MILLION;
  const llmCost = (totalTokens / 1_000_000) * FRONTIER_LLM_COST_PER_MILLION;
  const savingsFactor = llmCost / Math.max(jevCost, 1e-9);

  return {
    decisionCount,
    avgTokensPerDecision,
    totalTokens,
    jevCostUsd: Number(jevCost.toFixed(6)),
    llmCostUsd: Number(llmCost.toFixed(4)),
    savingsFactor: Number(savingsFactor.toFixed(1)),
    costPer1kDecisionsJev: Number(((jevCost / decisionCount) * 1000).toFixed(6)),
    costPer1kDecisionsLlm: Number(((llmCost / decisionCount) * 1000).toFixed(4))
  };
}

/**
 * Determines whether a decision should be escalated based on confidence ambiguity bands.
 * Fail-soft architecture: when confidence falls in ambiguous margin, routes to escalation.
 */
export function evaluateEscalationPolicy(confidence, lowerThreshold = 0.40, upperThreshold = 0.60) {
  if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) {
    throw new Error('confidence must be between 0 and 1');
  }

  if (confidence >= lowerThreshold && confidence <= upperThreshold) {
    return {
      action: 'ESCALATE_TO_FRONTIER',
      reason: `Ambiguous confidence level (${(confidence * 100).toFixed(1)}%) in fail-soft band [${(lowerThreshold * 100)}% - ${(upperThreshold * 100)}%]`,
      escalated: true
    };
  }

  return {
    action: 'AUTO_RESOLVE',
    reason: confidence > upperThreshold ? 'High confidence affirmative' : 'High confidence rejection',
    escalated: false
  };
}

/**
 * Runs a complete synthetic benchmark evaluation across decision datasets.
 */
export function runBenchmarkSuite(evalDataset) {
  const latencies = [];
  const predictions = [];
  let schemaViolations = 0;
  let totalEscalated = 0;

  for (const item of evalDataset) {
    latencies.push(item.latency_ms);
    predictions.push({
      probability: item.output.confidence ?? item.output.score ?? item.output.chosen_probability,
      actual: item.ground_truth
    });

    const schemaCheck = validateBoundedDecisionSchema(item.action_type, item.output, item.allowed_choices);
    if (!schemaCheck.valid) {
      schemaViolations += 1;
    }

    const escalation = evaluateEscalationPolicy(
      item.output.confidence ?? item.output.score ?? item.output.chosen_probability,
      item.lower_threshold,
      item.upper_threshold
    );
    if (escalation.escalated) {
      totalEscalated += 1;
    }
  }

  const brier = calculateBrierScore(predictions);
  const logLoss = calculateLogLoss(predictions);
  const ece = calculateExpectedCalibrationError(predictions);
  const latencyMetrics = calculateLatencyMetrics(latencies);
  const costMetrics = calculateCostEfficiency(evalDataset.length);

  return {
    totalItems: evalDataset.length,
    schemaViolations,
    schemaConformanceRate: (evalDataset.length - schemaViolations) / evalDataset.length,
    brierScore: Number(brier.toFixed(4)),
    logLoss: Number(logLoss.toFixed(4)),
    expectedCalibrationError: Number(ece.toFixed(4)),
    latency: latencyMetrics,
    cost: costMetrics,
    escalatedCases: totalEscalated,
    escalationRate: Number((totalEscalated / evalDataset.length).toFixed(3))
  };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  console.log('Jev Decision Model Benchmark Harness — Initializing standard evaluation...');
  // Simple demonstration run
  const demoDataset = [
    { action_type: 'verify', output: { decision: true, confidence: 0.94 }, ground_truth: true, latency_ms: 142 },
    { action_type: 'verify', output: { decision: false, confidence: 0.12 }, ground_truth: false, latency_ms: 168 },
    { action_type: 'screen', output: { passed: true, score: 0.88 }, ground_truth: true, latency_ms: 195 },
    { action_type: 'screen', output: { passed: false, score: 0.52 }, ground_truth: false, latency_ms: 210 },
    { action_type: 'decide', output: { choice: 'ROUTE_CIC', chosen_probability: 0.96, probabilities: { ROUTE_CIC: 0.96, ROUTE_OBSIDIAN: 0.04 } }, ground_truth: true, latency_ms: 180, allowed_choices: ['ROUTE_CIC', 'ROUTE_OBSIDIAN'] }
  ];

  const results = runBenchmarkSuite(demoDataset);
  console.log(JSON.stringify(results, null, 2));
}
