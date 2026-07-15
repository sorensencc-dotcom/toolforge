import { selectModel } from "./ModelSelector";
import { QualitySignal } from "../quality/qualityRoutingSignals";

const signal = (overrides: Partial<QualitySignal>): QualitySignal => ({
  adapter: "familysearch",
  confidence: 0,
  qualityBias: 0,
  escalate: false,
  reasoning: "",
  ...overrides,
});

describe("selectModel", () => {
  it("escalates to the highest tier when the quality signal demands it", () => {
    const result = selectModel(signal({ escalate: true, confidence: 0.99 }));

    expect(result.modelId).toBe("premium:opus");
  });

  it("picks the cheapest model whose confidence bar is met (local)", () => {
    const result = selectModel(signal({ confidence: 0.9 }));

    expect(result.modelId).toBe("local:llama-8b");
  });

  it("picks economy tier when confidence doesn't clear local's bar", () => {
    const result = selectModel(signal({ confidence: 0.75 }));

    expect(result.modelId).toBe("economy:haiku");
  });

  it("picks standard tier when confidence only clears the low bar", () => {
    const result = selectModel(signal({ confidence: 0.5 }));

    expect(result.modelId).toBe("standard:sonnet");
  });

  it("picks premium when confidence meets no tier's bar but premium's floor of 0", () => {
    const result = selectModel(signal({ confidence: 0 }));

    expect(result.modelId).toBe("premium:opus");
  });

  it("falls back to the highest tier when the catalog has no zero-floor entry", () => {
    const noFloorCatalog = [
      { id: "economy:haiku", tier: "economy" as const, costPerQuery: 0.001, minConfidence: 0.7 },
      { id: "standard:sonnet", tier: "standard" as const, costPerQuery: 0.01, minConfidence: 0.4 },
    ];

    const result = selectModel(signal({ confidence: 0 }), noFloorCatalog);

    expect(result.modelId).toBe("standard:sonnet");
    expect(result.reasoning).toContain("No model met confidence threshold");
  });
});
