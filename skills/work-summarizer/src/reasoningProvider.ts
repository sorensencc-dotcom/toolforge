export interface TranscriptChunk {
  source: "ClaudeCode" | "CICSession" | "OperatorNote";
  timestamp: string;
  text: string;
}

export interface SubsystemContext {
  subsystem: string;
  phase: string;
  files: string[];
  repos: string[];
  impactLevel: "low" | "medium" | "high" | "critical";
  driftSignals: Array<{ signalType: string; count: number; score: number }>;
  transcriptChunks: TranscriptChunk[];
}

export interface ReasoningInput {
  period: "daily" | "weekly";
  subsystemContexts: SubsystemContext[];
  dependencyGraph: Record<string, string[]>;
  driftSignals: Array<{ signalType: string; count: number; score: number }>;
}

export interface ReasoningOutput {
  transcript_excerpts: Array<{
    subsystem: string;
    phase: string;
    source: string;
    excerpt: string;
    reasoning_summary: string;
    timestamp: string;
  }>;
  subsystem_impacts: Array<{
    subsystem: string;
    phase: string;
    repos: string[];
    files: string[];
    impact_level: string;
    impact_summary: string;
    operator_actions: string[];
  }>;
  cross_repo_impacts: Array<{
    source_repo: string;
    affected_repos: string[];
    dependency_type: string;
    impact_summary: string;
    recommended_actions: string[];
  }>;
  notable_changes: Array<{
    title: string;
    description: string;
    subsystems: string[];
    risk_level: string;
    followup_required: boolean;
  }>;
  risks_or_followups: Array<{
    area: string;
    risk_summary: string;
    recommended_next_steps: string[];
  }>;
  message: string;
}

export interface ReasoningProvider {
  synthesize(input: ReasoningInput): Promise<ReasoningOutput>;
}
