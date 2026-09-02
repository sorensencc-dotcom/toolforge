import Anthropic from "@anthropic-ai/sdk";
import {
  ReasoningProvider,
  ReasoningInput,
  ReasoningOutput
} from "../reasoningProvider.js";

export class ClaudeProvider implements ReasoningProvider {
  private client: Anthropic;
  private model: string;
  private timeoutMs: number;

  constructor(apiKey: string, model: string = "claude-3-5-sonnet-20240620", timeoutMs: number = 30000) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
    this.timeoutMs = timeoutMs;
  }

  async synthesize(input: ReasoningInput): Promise<ReasoningOutput> {
    const prompt = this.buildPrompt(input);

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("LLM reasoning timeout")), this.timeoutMs)
    );

    const response = await Promise.race([
      this.client.messages.create({
        model: this.model,
        max_tokens: 2000,
        temperature: 0.2,
        system:
          "You are Work Summarizer v4, an operator-grade reasoning engine for CIC + Rewrite Labs + Toolforge. " +
          "You MUST respond with a single valid JSON object matching the specified schema. No prose outside JSON.",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      }),
      timeoutPromise
    ]);

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type from Claude");
    }

    // Extract JSON from markdown code blocks if present
    let jsonText = content.text;
    const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    }

    const parsed = JSON.parse(jsonText) as ReasoningOutput;
    this.validateOutput(parsed);
    return parsed;
  }

  private buildPrompt(input: ReasoningInput): string {
    const subsystemList = input.subsystemContexts
      .map(
        (ctx) =>
          `- ${ctx.subsystem} (phase: ${ctx.phase}, ${ctx.files.length} files, impact: ${ctx.impactLevel})`
      )
      .join("\n");

    const driftSummary = input.driftSignals
      .map((sig) => `  - ${sig.signalType}: ${sig.count} signals (score: ${sig.score})`)
      .join("\n");

    const depSummary = Object.entries(input.dependencyGraph)
      .map(([source, targets]) => `  - ${source} → ${targets.join(", ")}`)
      .join("\n");

    return `Given subsystem contexts, dependency graph, and drift signals, produce reasoning_output matching the ReasoningOutput schema:

## Period
${input.period}

## Subsystems
${subsystemList || "No subsystems"}

## Drift Signals
${driftSummary || "No drift detected"}

## Dependencies
${depSummary || "No dependencies"}

## Task
Produce a strict JSON object matching this exact structure:

{
  "transcript_excerpts": [
    {
      "subsystem": "<subsystem>",
      "phase": "<phase>",
      "source": "<source>",
      "excerpt": "<excerpt>",
      "reasoning_summary": "<why this matters>",
      "timestamp": "<ISO timestamp>"
    }
  ],
  "subsystem_impacts": [
    {
      "subsystem": "<name>",
      "phase": "<phase>",
      "repos": ["<repo>", ...],
      "files": ["<file>", ...],
      "impact_level": "low|medium|high|critical",
      "impact_summary": "<1-2 sentence summary>",
      "operator_actions": ["<action>", ...]
    }
  ],
  "cross_repo_impacts": [
    {
      "source_repo": "<repo>",
      "affected_repos": ["<repo>", ...],
      "dependency_type": "<type>",
      "impact_summary": "<summary>",
      "recommended_actions": ["<action>", ...]
    }
  ],
  "notable_changes": [
    {
      "title": "<title>",
      "description": "<description>",
      "subsystems": ["<subsystem>", ...],
      "risk_level": "low|medium|high|critical",
      "followup_required": true|false
    }
  ],
  "risks_or_followups": [
    {
      "area": "<area>",
      "risk_summary": "<summary>",
      "recommended_next_steps": ["<step>", ...]
    }
  ],
  "message": "<top-level summary>"
}

Rules:
- Only include subsystems present in input
- Be concise and operator-focused
- Avoid generic placeholders
- If no data for a section, return an empty array`;
  }

  private validateOutput(output: ReasoningOutput): void {
    if (!Array.isArray(output.transcript_excerpts)) {
      throw new Error("Invalid response: missing transcript_excerpts array");
    }
    if (!Array.isArray(output.subsystem_impacts)) {
      throw new Error("Invalid response: missing subsystem_impacts array");
    }
    if (!Array.isArray(output.cross_repo_impacts)) {
      throw new Error("Invalid response: missing cross_repo_impacts array");
    }
    if (!Array.isArray(output.notable_changes)) {
      throw new Error("Invalid response: missing notable_changes array");
    }
    if (!Array.isArray(output.risks_or_followups)) {
      throw new Error("Invalid response: missing risks_or_followups array");
    }
    if (typeof output.message !== "string") {
      throw new Error("Invalid response: missing message string");
    }
  }
}
