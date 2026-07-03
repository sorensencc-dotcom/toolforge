import Anthropic from "@anthropic-ai/sdk";
import { TranscriptExcerpt } from "./transcript-excerpts.js";
import { CrossImpact } from "./dependency-graph.js";

export interface LLMContext {
  period: "daily" | "weekly";
  activeCategories: string[];
  workByCategory: Record<string, number>;
  allModifiedFiles: string[];
  repo_deltas: any[];
  driftSignal: any;
  crossImpacts: CrossImpact[];
  transcriptExcerpts: TranscriptExcerpt[];
}

export interface LLMSynthesis {
  subsystem_impacts: Array<{
    subsystem: string;
    impact_summary: string;
    operator_actions: string[];
  }>;
  cross_repo_impacts: Array<{
    source_category: string;
    affected_categories: string[];
    impact_summary: string;
    recommended_actions: string[];
  }>;
  notable_changes: Array<{
    title: string;
    description: string;
    risk_level: "low" | "medium" | "high" | "critical";
  }>;
  risks_or_followups: Array<{
    area: string;
    risk_summary: string;
    recommended_next_steps: string[];
  }>;
  transcript_reasoning: Record<string, string>; // { excerpt_id -> reasoning_summary }
  message: string;
}

export class AnthropicProvider {
  private client: Anthropic;
  private model: string;
  private timeoutMs: number;

  constructor(apiKey: string, model: string, timeoutMs: number = 30000) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
    this.timeoutMs = timeoutMs;
  }

  async synthesize(context: LLMContext): Promise<LLMSynthesis> {
    const prompt = this.buildPrompt(context);

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("LLM reasoning timeout")), this.timeoutMs)
    );

    const response = await Promise.race([
      this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
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
      throw new Error("Unexpected response type from LLM");
    }

    // Extract JSON from markdown code blocks if present
    let jsonText = content.text;
    const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    }

    const parsed = JSON.parse(jsonText) as LLMSynthesis;
    if (!parsed.subsystem_impacts || !Array.isArray(parsed.subsystem_impacts)) {
      throw new Error("Invalid LLM response: missing subsystem_impacts array");
    }
    if (!parsed.cross_repo_impacts || !Array.isArray(parsed.cross_repo_impacts)) {
      throw new Error("Invalid LLM response: missing cross_repo_impacts array");
    }
    if (!parsed.notable_changes || !Array.isArray(parsed.notable_changes)) {
      throw new Error("Invalid LLM response: missing notable_changes array");
    }
    if (!parsed.risks_or_followups || !Array.isArray(parsed.risks_or_followups)) {
      throw new Error("Invalid LLM response: missing risks_or_followups array");
    }
    if (!parsed.transcript_reasoning || typeof parsed.transcript_reasoning !== "object") {
      throw new Error("Invalid LLM response: missing transcript_reasoning object");
    }
    if (typeof parsed.message !== "string") {
      throw new Error("Invalid LLM response: missing message string");
    }

    return parsed;
  }

  private buildPrompt(context: LLMContext): string {
    const categoryList = context.activeCategories.join(", ");
    const crossImpactSummary = context.crossImpacts
      .map(
        ci =>
          `- ${ci.source} → ${ci.affected_categories.join(", ")} (${ci.impact_level})`
      )
      .join("\n");

    const fileSummary = context.allModifiedFiles
      .slice(0, 20)
      .map(f => `  - ${f}`)
      .join("\n");

    const excerptSummary = context.transcriptExcerpts
      .map((exc, idx) => `[${idx}] ${exc.subsystem}: "${exc.excerpt}"`)
      .join("\n");

    return `You are Work Summarizer, an operator-grade reasoning engine for CIC + Rewrite Labs + Toolforge.

Your job is to analyze work activity and synthesize operator-focused reasoning.

## Context

Period: ${context.period}
Active Categories: ${categoryList}
Modified Files: ${context.allModifiedFiles.length}
Drift Signals: ${context.driftSignal.count} (score: ${context.driftSignal.score ?? 0})

## Cross-Repo Impact Graph

${crossImpactSummary || "No cross-repo impacts detected."}

## Modified Files (sample)

${fileSummary || "No files modified."}

## Transcript Excerpts

${excerptSummary || "No relevant transcript excerpts found."}

## Task

Produce a strict JSON object with this exact structure:

{
  "subsystem_impacts": [
    {
      "subsystem": "<category name>",
      "impact_summary": "<1–2 sentence summary of impact>",
      "operator_actions": ["<action>", ...]
    }
  ],
  "cross_repo_impacts": [
    {
      "source_category": "<category>",
      "affected_categories": ["<category>", ...],
      "impact_summary": "<summary of downstream impact>",
      "recommended_actions": ["<action>", ...]
    }
  ],
  "notable_changes": [
    {
      "title": "<change title>",
      "description": "<1–2 sentence description>",
      "risk_level": "low|medium|high|critical"
    }
  ],
  "risks_or_followups": [
    {
      "area": "<subsystem or area>",
      "risk_summary": "<1–2 sentence risk description>",
      "recommended_next_steps": ["<step>", ...]
    }
  ],
  "transcript_reasoning": {
    "excerpt_0": "<why excerpt 0 matters>",
    "excerpt_1": "<why excerpt 1 matters>",
    ...
  },
  "message": "<1–2 sentence top-level summary of the period>"
}

## Rules

- Only include subsystem_impacts for categories in the Active Categories list.
- Only include cross_repo_impacts for edges present in the graph.
- Do not invent categories, files, or repos.
- Be concise and operator-focused.
- Avoid generic placeholders.
- If no data for a section, return an empty array.`;
  }
}
