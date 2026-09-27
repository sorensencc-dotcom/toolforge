import { computeGateThreshold, evaluateRegression } from './stats.mjs';

/**
 * Evaluates current stage metrics against a baseline artifact.
 * @param {Record<string, import('./stats.mjs').StageMetrics>} currentMetrics Measured stage metrics.
 * @param {Object} baselineArtifact Parsed baseline artifact JSON.
 * @returns {{ passed: boolean, findings: string[], improvements: string[] }}
 */
export function evaluatePipelineStages(currentMetrics, baselineArtifact) {
  const findings = [];
  const improvements = [];
  let passed = true;

  if (!currentMetrics || typeof currentMetrics !== 'object') {
    return { passed, findings, improvements };
  }

  const baselineStages = baselineArtifact?.stages;
  if (!baselineStages || typeof baselineStages !== 'object') {
    return { passed, findings, improvements };
  }

  for (const [stage, metrics] of Object.entries(currentMetrics)) {
    const baselineStage = baselineStages[stage];
    if (!baselineStage || typeof baselineStage !== 'object') {
      continue;
    }

    const baselineP50 = baselineStage.p50_ms ?? baselineStage.p50Ms;
    if (typeof baselineP50 !== 'number' || Number.isNaN(baselineP50)) {
      continue;
    }

    const currentP50 = metrics?.p50Ms ?? metrics?.p50_ms;
    if (typeof currentP50 !== 'number' || Number.isNaN(currentP50)) {
      continue;
    }

    const ceiling = baselineStage.ceiling_limit_ms ?? baselineStage.ceilingLimitMs ?? 1000;
    const status = evaluateRegression(currentP50, baselineP50, ceiling);

    if (status === 'FAIL') {
      passed = false;
      const allowed = computeGateThreshold(baselineP50, ceiling);
      findings.push(
        `Regression in stage '${stage}': measured p50 ${currentP50.toFixed(2)}ms exceeds threshold ${allowed.toFixed(2)}ms`
      );
    } else if (status === 'IMPROVEMENT') {
      const improvementThreshold = baselineP50 * 0.70;
      improvements.push(
        `Improvement in stage '${stage}': measured p50 ${currentP50.toFixed(2)}ms is below 0.70x baseline (${improvementThreshold.toFixed(2)}ms)`
      );
    }
  }

  return { passed, findings, improvements };
}
