import { QualitySignal } from "../quality/qualityRoutingSignals";
import { MODEL_CATALOG, ModelCandidate } from "./modelCatalog";

export interface ModelSelection {
  modelId: string;
  tier: ModelCandidate["tier"];
  costPerQuery: number;
  reasoning: string;
}

/**
 * Cost-optimized, quality-aware model selection:
 * pick the cheapest catalog entry whose minConfidence is met by the
 * quality signal's confidence, unless the signal demands escalation
 * (CRITICAL drift/hydration failure), in which case always route to
 * the highest-capability tier regardless of cost.
 */
export function selectModel(
  quality: QualitySignal,
  catalog: ModelCandidate[] = MODEL_CATALOG
): ModelSelection {
  const highestTier = catalog[catalog.length - 1];

  if (quality.escalate) {
    return {
      modelId: highestTier.id,
      tier: highestTier.tier,
      costPerQuery: highestTier.costPerQuery,
      reasoning: `Escalated to ${highestTier.id}: ${quality.reasoning}`,
    };
  }

  const eligible = catalog
    .filter((c) => quality.confidence >= c.minConfidence)
    .sort((a, b) => a.costPerQuery - b.costPerQuery);

  if (eligible.length === 0) {
    return {
      modelId: highestTier.id,
      tier: highestTier.tier,
      costPerQuery: highestTier.costPerQuery,
      reasoning: `No model met confidence threshold (${quality.confidence.toFixed(2)}): escalated to ${highestTier.id}`,
    };
  }

  const choice = eligible[0];
  return {
    modelId: choice.id,
    tier: choice.tier,
    costPerQuery: choice.costPerQuery,
    reasoning: `Confidence ${quality.confidence.toFixed(2)} meets ${choice.id} threshold (${choice.minConfidence}): ${quality.reasoning}`,
  };
}
