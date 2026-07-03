import {
  ReasoningProvider,
  ReasoningInput,
  ReasoningOutput
} from "../reasoningProvider.js";

export class OllamaProvider implements ReasoningProvider {
  constructor(private modelName: string = "llama3") {}

  async synthesize(input: ReasoningInput): Promise<ReasoningOutput> {
    // Stub: deterministic placeholder until wired to Ollama HTTP API.
    // For now, just echo deterministic structure with minimal content.
    return {
      transcript_excerpts: [],
      subsystem_impacts: input.subsystemContexts.map((ctx) => ({
        subsystem: ctx.subsystem,
        phase: ctx.phase,
        repos: ctx.repos,
        files: ctx.files,
        impact_level: ctx.impactLevel,
        impact_summary: "[Ollama stub] Reasoning not yet implemented.",
        operator_actions: []
      })),
      cross_repo_impacts: [],
      notable_changes: [],
      risks_or_followups: [],
      message: "[Ollama stub] Reasoning layer not yet connected."
    };
  }
}
