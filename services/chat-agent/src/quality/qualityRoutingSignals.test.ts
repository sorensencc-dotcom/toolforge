import { getQualitySignal } from "./qualityRoutingSignals";
import { QualityMetrics } from "./types";

const metrics = (
  hitRate: number,
  driftSeverities: string[] = [],
  hydrationSeverities: string[] = []
): QualityMetrics => ({
  hitRate,
  driftSignals: driftSeverities.map((severity) => ({ severity: severity as any })),
  hydrationFailures: hydrationSeverities.map((severity) => ({ severity: severity as any })),
});

describe("getQualitySignal", () => {
  it("forces escalation on a CRITICAL drift signal regardless of hit rate", () => {
    const signal = getQualitySignal("familysearch", metrics(0.99, ["CRITICAL"]));

    expect(signal.escalate).toBe(true);
    expect(signal.confidence).toBe(0);
    expect(signal.qualityBias).toBe(-0.25);
  });

  it("forces escalation on a CRITICAL hydration failure regardless of hit rate", () => {
    const signal = getQualitySignal("familysearch", metrics(0.99, [], ["CRITICAL"]));

    expect(signal.escalate).toBe(true);
    expect(signal.confidence).toBe(0);
  });

  it("halves confidence on a HIGH signal and escalates if still below 0.5", () => {
    const signal = getQualitySignal("familysearch", metrics(0.6, ["HIGH"]));

    expect(signal.confidence).toBeCloseTo(0.3);
    expect(signal.qualityBias).toBe(-0.1);
    expect(signal.escalate).toBe(true);
  });

  it("halves confidence on a HIGH signal but does not escalate if still >= 0.5", () => {
    const signal = getQualitySignal("familysearch", metrics(1.0, ["HIGH"]));

    expect(signal.confidence).toBeCloseTo(0.5);
    expect(signal.escalate).toBe(false);
  });

  it("gives strong bias for confidence > 0.9 with no drift/hydration signals", () => {
    const signal = getQualitySignal("familysearch", metrics(0.95));

    expect(signal.confidence).toBe(0.95);
    expect(signal.qualityBias).toBe(0.25);
    expect(signal.escalate).toBe(false);
  });

  it("gives moderate bias for confidence between 0.7 and 0.9", () => {
    const signal = getQualitySignal("familysearch", metrics(0.8));

    expect(signal.qualityBias).toBe(0.1);
  });

  it("gives no bias for confidence <= 0.7", () => {
    const signal = getQualitySignal("familysearch", metrics(0.5));

    expect(signal.qualityBias).toBe(0);
    expect(signal.escalate).toBe(false);
  });

  it("takes the worst severity across drift and hydration signals combined", () => {
    const signal = getQualitySignal(
      "familysearch",
      metrics(0.95, ["LOW"], ["CRITICAL"])
    );

    expect(signal.escalate).toBe(true);
    expect(signal.confidence).toBe(0);
  });
});
