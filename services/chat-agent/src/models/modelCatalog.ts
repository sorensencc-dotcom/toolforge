export type ModelTier = "local" | "economy" | "standard" | "premium";

export interface ModelCandidate {
  id: string;
  tier: ModelTier;
  costPerQuery: number;
  /** Minimum quality-signal confidence required to safely route here. */
  minConfidence: number;
}

/**
 * Ordered cheapest -> most capable. ModelSelector picks the first
 * candidate whose minConfidence is satisfied, unless escalate is set.
 */
export const MODEL_CATALOG: ModelCandidate[] = [
  { id: "local:llama-8b", tier: "local", costPerQuery: 0, minConfidence: 0.85 },
  { id: "economy:haiku", tier: "economy", costPerQuery: 0.001, minConfidence: 0.7 },
  { id: "standard:sonnet", tier: "standard", costPerQuery: 0.01, minConfidence: 0.4 },
  { id: "premium:opus", tier: "premium", costPerQuery: 0.05, minConfidence: 0 },
];
