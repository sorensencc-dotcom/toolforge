import { createHash } from 'node:crypto';
import type { ResearchReceipt, ResearchRequest, ResearchResult } from './types.js';

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === 'object') return Object.keys(value as object).sort().reduce<Record<string, unknown>>((out, key) => { out[key] = sortKeys((value as Record<string, unknown>)[key]); return out; }, {});
  return value;
}

export function canonicalSerialize(value: unknown): string { return JSON.stringify(sortKeys(value)); }
export function sha256(value: unknown): string { return createHash('sha256').update(canonicalSerialize(value), 'utf8').digest('hex'); }

export function buildReceipt(request: ResearchRequest, result: ResearchResult, metadata: { policy_version: string; adapter_version: string; created_at: string; receipt_path?: string }): ResearchReceipt {
  if (request.correlation_id !== result.correlation_id) throw new Error('correlation_id mismatch');
  if (!['accepted', 'rejected', 'timed_out', 'indeterminate'].includes(result.outcome)) throw new Error('invalid outcome');
  return {
    receipt_version: '1', correlation_id: request.correlation_id, workspace_id: request.workspace_id, operator_id: request.operator_id,
    source_references: result.source_references, workflow_id: result.workflow_id, workflow_intent: request.workflow_intent,
    provider: result.provider, model: result.model, input_hash: sha256(request.input), output_hash: sha256(result.draft_output),
    draft_output: result.draft_output, outcome: result.outcome, policy_version: metadata.policy_version, adapter_version: metadata.adapter_version,
    created_at: metadata.created_at, receipt_path: metadata.receipt_path ?? '',
  };
}
