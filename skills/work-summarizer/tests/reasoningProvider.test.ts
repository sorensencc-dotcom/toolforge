import { describe, it, expect } from "vitest";
import {
  ReasoningProvider,
  ReasoningInput,
  ReasoningOutput
} from "../src/reasoningProvider";
import { OllamaProvider } from "../src/providers/ollamaProvider";

class FakeReasoningProvider implements ReasoningProvider {
  async synthesize(input: ReasoningInput): Promise<ReasoningOutput> {
    return {
      transcript_excerpts: [],
      subsystem_impacts: input.subsystemContexts.map((ctx) => ({
        subsystem: ctx.subsystem,
        phase: ctx.phase,
        repos: ctx.repos,
        files: ctx.files,
        impact_level: ctx.impactLevel,
        impact_summary: "Fake reasoning summary.",
        operator_actions: ["Fake action"]
      })),
      cross_repo_impacts: [],
      notable_changes: [],
      risks_or_followups: [],
      message: "Fake reasoning provider used."
    };
  }
}

describe("ReasoningProvider implementations", () => {
  const baseInput: ReasoningInput = {
    period: "daily",
    subsystemContexts: [
      {
        subsystem: "cic-core",
        phase: "Phase A",
        files: ["cic/ingest.ts", "cic/queue.ts"],
        repos: ["cic-core"],
        impactLevel: "high",
        driftSignals: [{ signalType: "routing-drift", count: 2, score: 0.7 }],
        transcriptChunks: [
          {
            source: "ClaudeCode",
            timestamp: "2026-07-02T12:00:00Z",
            text: "Updated ingest queue for determinism"
          }
        ]
      }
    ],
    dependencyGraph: {
      "cic-core": ["rewrite-labs", "toolforge"]
    },
    driftSignals: [{ signalType: "routing-drift", count: 2, score: 0.7 }]
  };

  it("FakeProvider returns valid output", async () => {
    const provider = new FakeReasoningProvider();
    const output = await provider.synthesize(baseInput);

    expect(output.subsystem_impacts).toHaveLength(1);
    expect(output.subsystem_impacts[0].subsystem).toBe("cic-core");
    expect(output.message).toBe("Fake reasoning provider used.");
  });

  it("OllamaProvider returns deterministic fallback (no server)", async () => {
    const provider = new OllamaProvider("llama3");
    const output = await provider.synthesize(baseInput);

    // OllamaProvider attempts HTTP call, falls back to deterministic on connection failure
    expect(output.subsystem_impacts).toHaveLength(1);
    expect(output.subsystem_impacts[0].subsystem).toBe("cic-core");
    expect(output.subsystem_impacts[0].impact_summary).toContain("Ollama");
    expect(output.message).toContain("Ollama");
  });

  it("Output structure matches ReasoningOutput schema", async () => {
    const provider = new FakeReasoningProvider();
    const output = await provider.synthesize(baseInput);

    expect(output).toHaveProperty("transcript_excerpts");
    expect(output).toHaveProperty("subsystem_impacts");
    expect(output).toHaveProperty("cross_repo_impacts");
    expect(output).toHaveProperty("notable_changes");
    expect(output).toHaveProperty("risks_or_followups");
    expect(output).toHaveProperty("message");

    expect(Array.isArray(output.transcript_excerpts)).toBe(true);
    expect(Array.isArray(output.subsystem_impacts)).toBe(true);
    expect(Array.isArray(output.cross_repo_impacts)).toBe(true);
    expect(Array.isArray(output.notable_changes)).toBe(true);
    expect(Array.isArray(output.risks_or_followups)).toBe(true);
    expect(typeof output.message).toBe("string");
  });

  it("Handles empty subsystem contexts", async () => {
    const provider = new FakeReasoningProvider();
    const emptyInput: ReasoningInput = {
      period: "daily",
      subsystemContexts: [],
      dependencyGraph: {},
      driftSignals: []
    };

    const output = await provider.synthesize(emptyInput);

    expect(output.subsystem_impacts).toHaveLength(0);
    expect(Array.isArray(output.transcript_excerpts)).toBe(true);
  });
});
