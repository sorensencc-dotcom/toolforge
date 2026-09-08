import { WORKFLOW_INTENTS, type PolicyDecision, type ProviderSelection, type ResearchRequest } from './types.js';

const required = ['correlation_id', 'workspace_id', 'operator_id', 'source_references', 'workflow_intent', 'provider_opt_in', 'input', 'timeout_ms', 'max_output_bytes'];
const forbiddenIntents = new Set(['write-canonical', 'canonical-write', 'publish-canonical']);

function reject(reason: string): PolicyDecision { return { allowed: false, reason }; }

export function validatePolicy(request: ResearchRequest, selection: ProviderSelection): PolicyDecision {
  if (!request || typeof request !== 'object') return reject('request must be an object');
  const keys = Object.keys(request as object);
  const unknown = keys.filter((key) => !required.includes(key));
  if (unknown.length) return reject(`unknown request field: ${unknown[0]}`);
  for (const key of required) if (!(key in request)) return reject(`missing request field: ${key}`);
  if (typeof request.correlation_id !== 'string' || !request.correlation_id) return reject('correlation_id is required');
  if (typeof request.workspace_id !== 'string' || !request.workspace_id) return reject('workspace_id is required');
  if (typeof request.operator_id !== 'string' || !request.operator_id) return reject('operator_id is required');
  if (!WORKFLOW_INTENTS.includes(request.workflow_intent)) return reject('workflow_intent is not allowed');
  if (forbiddenIntents.has(request.workflow_intent)) return reject('canonical-write intent is forbidden');
  if (!Array.isArray(request.source_references) || request.source_references.length === 0) return reject('source_references are required');
  if (typeof request.input !== 'string' || !request.input) return reject('input is required');
  if (!Number.isInteger(request.timeout_ms) || request.timeout_ms <= 0) return reject('timeout_ms must be positive');
  if (!Number.isInteger(request.max_output_bytes) || request.max_output_bytes <= 0) return reject('max_output_bytes must be positive');
  if (!selection || typeof selection.provider !== 'string' || typeof selection.model !== 'string') return reject('WhichLLM selection is required');
  if (!request.provider_opt_in || typeof request.provider_opt_in !== 'object') return reject('provider_opt_in is required');
  const providerKeys = Object.keys(request.provider_opt_in);
  if (providerKeys.some((key) => !['provider', 'model'].includes(key))) return reject('unknown provider_opt_in field');
  if (typeof request.provider_opt_in.provider !== 'string' || typeof request.provider_opt_in.model !== 'string') return reject('provider_opt_in must contain provider and model');
  for (const source of request.source_references) {
    if (!source || typeof source !== 'object' || Object.keys(source).some((key) => !['id', 'uri'].includes(key)) || typeof source.id !== 'string' || typeof source.uri !== 'string' || !source.id || !source.uri) return reject('source_references must contain strict id and uri objects');
  }
  if (request.provider_opt_in.provider !== selection.provider || request.provider_opt_in.model !== selection.model) return reject('provider/model does not match WhichLLM selection');
  return { allowed: true };
}
