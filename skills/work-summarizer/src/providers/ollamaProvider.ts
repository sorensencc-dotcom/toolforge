import {
  ReasoningProvider,
  ReasoningInput,
  ReasoningOutput
} from "../reasoningProvider.js";

export class OllamaProvider implements ReasoningProvider {
  private baseUrl: string;
  private timeoutMs: number;

  constructor(
    private modelName: string = "llama3",
    baseUrl: string = "http://localhost:11434",
    timeoutMs: number = 30000
  ) {
    this.baseUrl = baseUrl;
    this.timeoutMs = timeoutMs;
  }

  async synthesize(input: ReasoningInput): Promise<ReasoningOutput> {
    try {
      const prompt = this.buildPrompt(input);
      const response = await this.callOllama(prompt);
      return this.parseResponse(response, input);
    } catch (error: any) {
      // Fallback to deterministic mode if Ollama unavailable
      console.warn(`Ollama reasoning failed (${error?.message}), returning deterministic output`);
      return this.deterministic(input);
    }
  }

  private async callOllama(prompt: string): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.modelName,
          prompt,
          stream: false,
          temperature: 0.2,
          top_p: 0.9
        }),
        signal: controller.signal
      } as any);

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as { response: string };
      return data.response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private buildPrompt(input: ReasoningInput): string {
    const subsystemList = input.subsystemContexts
      .map((ctx) => `- ${ctx.subsystem} (${ctx.impactLevel})`)
      .join("\n");

    return `You are Work Summarizer, an operator-grade reasoning engine.

Analyze the following work activity and respond with ONLY a JSON object matching this schema:

{
  "transcript_excerpts": [],
  "subsystem_impacts": [
    {
      "subsystem": "<name>",
      "phase": "<phase>",
      "repos": ["<repo>"],
      "files": ["<file>"],
      "impact_level": "low|medium|high|critical",
      "impact_summary": "<summary>",
      "operator_actions": ["<action>"]
    }
  ],
  "cross_repo_impacts": [],
  "notable_changes": [],
  "risks_or_followups": [],
  "message": "<summary>"
}

Period: ${input.period}
Subsystems:
${subsystemList}

Respond with ONLY valid JSON.`;
  }

  private parseResponse(response: string, input: ReasoningInput): ReasoningOutput {
    try {
      // Try to parse direct JSON
      const parsed = JSON.parse(response);
      if (this.isValidOutput(parsed)) {
        return parsed;
      }
    } catch {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (this.isValidOutput(parsed)) {
            return parsed;
          }
        } catch {
          // Fall through to deterministic
        }
      }
    }

    // Fallback to deterministic if parse fails
    return this.deterministic(input);
  }

  private isValidOutput(obj: any): obj is ReasoningOutput {
    return (
      obj &&
      Array.isArray(obj.transcript_excerpts) &&
      Array.isArray(obj.subsystem_impacts) &&
      Array.isArray(obj.cross_repo_impacts) &&
      Array.isArray(obj.notable_changes) &&
      Array.isArray(obj.risks_or_followups) &&
      typeof obj.message === "string"
    );
  }

  private deterministic(input: ReasoningInput): ReasoningOutput {
    return {
      transcript_excerpts: [],
      subsystem_impacts: input.subsystemContexts.map((ctx) => ({
        subsystem: ctx.subsystem,
        phase: ctx.phase,
        repos: ctx.repos,
        files: ctx.files,
        impact_level: ctx.impactLevel,
        impact_summary: `[Ollama] Activity in ${ctx.subsystem} at ${ctx.impactLevel} impact.`,
        operator_actions: []
      })),
      cross_repo_impacts: [],
      notable_changes: [],
      risks_or_followups: [],
      message: "[Ollama] Reasoning layer operational but awaiting model response."
    };
  }
}
