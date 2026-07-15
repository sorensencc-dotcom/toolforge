/**
 * Quality Routing Signals
 * Model-selection bias derived from CIC Ingestion quality metrics
 * (drift signals, hydration failures, warm-pool hit rate).
 *
 * Mirrors the shape/tiering convention of cic-ingestion's
 * orchestrator/routingCostSignals.ts (RoutingSignal / localBias),
 * so callers can combine a cost bias and a quality bias the same way.
 */

import { QualityMetrics, Severity } from "./types";

export interface QualitySignal {
  adapter: string;
  confidence: number; // 0..1, hitRate adjusted down for drift/hydration severity
  qualityBias: number; // +0.25/+0.10 = safe to downgrade to a cheaper model, 0 = neutral
  escalate: boolean; // true = force the highest-tier model regardless of cost bias
  reasoning: string;
}

function worstSeverity(
  driftSignals: QualityMetrics["driftSignals"],
  hydrationFailures: QualityMetrics["hydrationFailures"]
): Severity | null {
  const order: Severity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
  const all = [...driftSignals, ...hydrationFailures];
  if (all.length === 0) return null;

  return all.reduce<Severity>((worst, signal) => {
    return order.indexOf(signal.severity) > order.indexOf(worst)
      ? signal.severity
      : worst;
  }, "LOW");
}

/**
 * Quality bias tiers (mirrors routingCostSignals.ts local-bias tiers):
 *   CRITICAL drift/hydration signal  -> confidence 0, escalate, bias -0.25
 *   HIGH drift/hydration signal      -> confidence halved, bias -0.10 (escalate if still < 0.5)
 *   confidence > 0.9                 -> bias +0.25 (safe to prefer cheaper model)
 *   confidence > 0.7                 -> bias +0.10
 *   else                              -> bias 0
 */
export function getQualitySignal(
  adapter: string,
  metrics: QualityMetrics
): QualitySignal {
  const severity = worstSeverity(metrics.driftSignals, metrics.hydrationFailures);

  if (severity === "CRITICAL") {
    return {
      adapter,
      confidence: 0,
      qualityBias: -0.25,
      escalate: true,
      reasoning: "CRITICAL drift/hydration signal: force highest-tier model",
    };
  }

  if (severity === "HIGH") {
    const confidence = metrics.hitRate * 0.5;
    return {
      adapter,
      confidence,
      qualityBias: -0.1,
      escalate: confidence < 0.5,
      reasoning: `HIGH drift/hydration signal: confidence halved to ${confidence.toFixed(2)}`,
    };
  }

  const confidence = metrics.hitRate;

  if (confidence > 0.9) {
    return {
      adapter,
      confidence,
      qualityBias: 0.25,
      escalate: false,
      reasoning: `Strong confidence (${confidence.toFixed(2)}): safe to prefer cheaper model`,
    };
  }

  if (confidence > 0.7) {
    return {
      adapter,
      confidence,
      qualityBias: 0.1,
      escalate: false,
      reasoning: `Moderate confidence (${confidence.toFixed(2)}): weak preference for cheaper model`,
    };
  }

  return {
    adapter,
    confidence,
    qualityBias: 0,
    escalate: false,
    reasoning: `Low confidence (${confidence.toFixed(2)}): no cost-tier preference`,
  };
}
