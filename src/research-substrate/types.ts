export const WORKFLOW_INTENTS = ['research', 'summarize', 'extract', 'analyze'] as const;
export type WorkflowIntent = typeof WORKFLOW_INTENTS[number];
export type ResearchOutcome = 'accepted' | 'rejected' | 'timed_out' | 'indeterminate';

export interface SourceReference { id: string; uri: string; }
export interface ProviderSelection { provider: string; model: string; }

export interface ResearchRequest {
  correlation_id: string;
  workspace_id: string;
  operator_id: string;
  source_references: SourceReference[];
  workflow_intent: WorkflowIntent;
  provider_opt_in: ProviderSelection;
  input: string;
  timeout_ms: number;
  max_output_bytes: number;
}

export interface ResearchResult {
  correlation_id: string;
  draft_output: string;
  source_references: SourceReference[];
  model: string;
  provider: string;
  workflow_id: string;
  outcome: ResearchOutcome;
}

export interface PolicyDecision { allowed: boolean; reason?: string; }

export interface ResearchReceipt {
  receipt_version: '1';
  correlation_id: string;
  workspace_id: string;
  operator_id: string;
  source_references: SourceReference[];
  workflow_id: string;
  workflow_intent: WorkflowIntent;
  provider: string;
  model: string;
  input_hash: string;
  output_hash: string;
  draft_output: string;
  outcome: ResearchOutcome;
  policy_version: string;
  adapter_version: string;
  created_at: string;
  receipt_path: string;
}
