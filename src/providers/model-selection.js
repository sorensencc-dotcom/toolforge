import fs from 'node:fs';
import path from 'node:path';

export function loadModelSelection(repoRoot = process.cwd()) {
  const file = path.join(repoRoot, '_integration', 'model_selection.json');
  const record = JSON.parse(fs.readFileSync(file, 'utf8'));
  const provider = record.provider;
  const model = record.validated_local_model?.model ?? record.model;
  if (record.routing_state !== 'local-only' || record.cloud_routing_enabled !== false || provider !== 'ollama' || typeof model !== 'string') {
    throw new Error('MODEL_SELECTION_REJECTED: local Ollama routing record is not valid');
  }
  return { ...record, provider, model };
}

export function validateProviderEcho({ requestedProvider, requestedModel, echoedProvider, echoedModel }) {
  const mismatch = requestedProvider !== echoedProvider || requestedModel !== echoedModel;
  if (mismatch) {
    const receipt = { event_type: 'provider_echo_mismatch', requested_provider: requestedProvider, requested_model: requestedModel, echoed_provider: echoedProvider ?? null, echoed_model: echoedModel ?? null, retry: false, fallback: false };
    const error = new Error('PROVIDER_ECHO_MISMATCH: requested provider/model differs from echoed provider/model');
    error.receipt = receipt;
    error.trmEvent = { ...receipt, event_type: 'trm_provider_validation_failed', reason: 'provider_echo_mismatch' };
    throw error;
  }
}
