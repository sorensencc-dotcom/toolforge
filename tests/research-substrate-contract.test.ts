import { strict as assert } from 'node:assert';
import test from 'node:test';
import { validatePolicy } from '../src/research-substrate/policy.ts';
import { buildReceipt, canonicalSerialize, sha256 } from '../src/research-substrate/receipt.ts';
import type { ResearchRequest, ResearchResult } from '../src/research-substrate/types.ts';

const selection = { provider: 'ollama', model: 'llama3:8b-instruct-fp16' };
const request: ResearchRequest = { correlation_id: 'c-1', workspace_id: 'w-1', operator_id: 'o-1', source_references: [{ id: 's-1', uri: 'file:///source' }], workflow_intent: 'research', provider_opt_in: selection, input: 'question', timeout_ms: 1000, max_output_bytes: 10000 };
const result: ResearchResult = { correlation_id: 'c-1', draft_output: 'answer', source_references: request.source_references, model: selection.model, provider: selection.provider, workflow_id: 'wf-1', outcome: 'accepted' };

test('validatePolicy - rejects invalid or missing requests', () => {
  assert.equal(validatePolicy(null as unknown as ResearchRequest, selection).allowed, false);
  assert.equal(validatePolicy(undefined as unknown as ResearchRequest, selection).allowed, false);
  assert.equal(validatePolicy('string' as unknown as ResearchRequest, selection).allowed, false);

  // missing required field
  const missingField = { ...request };
  delete (missingField as any).correlation_id;
  assert.equal(validatePolicy(missingField as ResearchRequest, selection).allowed, false);
});

test('validatePolicy - strict string validations', () => {
  assert.equal(validatePolicy({ ...request, correlation_id: '' } as ResearchRequest, selection).allowed, false);
  assert.equal(validatePolicy({ ...request, workspace_id: '' } as ResearchRequest, selection).allowed, false);
  assert.equal(validatePolicy({ ...request, operator_id: '' } as ResearchRequest, selection).allowed, false);
  assert.equal(validatePolicy({ ...request, input: '' } as ResearchRequest, selection).allowed, false);
  assert.equal(validatePolicy({ ...request, input: 123 as any } as ResearchRequest, selection).allowed, false);
});

test('validatePolicy - intent validations', () => {
  assert.equal(validatePolicy({ ...request, workflow_intent: 'unknown' as any } as ResearchRequest, selection).allowed, false);
  assert.equal(validatePolicy({ ...request, workflow_intent: 'publish-canonical' as any } as ResearchRequest, selection).allowed, false);
  assert.equal(validatePolicy({ ...request, workflow_intent: 'canonical-write' as any } as ResearchRequest, selection).allowed, false);
});

test('validatePolicy - numeric and array constraints', () => {
  assert.equal(validatePolicy({ ...request, timeout_ms: 0 } as ResearchRequest, selection).allowed, false);
  assert.equal(validatePolicy({ ...request, timeout_ms: -1 } as ResearchRequest, selection).allowed, false);
  assert.equal(validatePolicy({ ...request, timeout_ms: 10.5 } as ResearchRequest, selection).allowed, false);
  assert.equal(validatePolicy({ ...request, max_output_bytes: 0 } as ResearchRequest, selection).allowed, false);

  assert.equal(validatePolicy({ ...request, source_references: [] } as ResearchRequest, selection).allowed, false);
  assert.equal(validatePolicy({ ...request, source_references: 'string' as any } as ResearchRequest, selection).allowed, false);
});

test('validatePolicy - ProviderSelection and provider_opt_in constraints', () => {
  // invalid selection
  assert.equal(validatePolicy(request, null as any).allowed, false);
  assert.equal(validatePolicy(request, { provider: 'ollama' } as any).allowed, false);

  // provider_opt_in mismatches or invalid structure
  assert.equal(validatePolicy({ ...request, provider_opt_in: null as any } as ResearchRequest, selection).allowed, false);
  assert.equal(validatePolicy({ ...request, provider_opt_in: { provider: 'ollama' } as any } as ResearchRequest, selection).allowed, false);
  assert.equal(validatePolicy({ ...request, provider_opt_in: { provider: 'ollama', model: 'llama3:8b-instruct-fp16', extra: true } as any } as ResearchRequest, selection).allowed, false);
});

test('validatePolicy - strict SourceReferences constraints', () => {
  assert.equal(validatePolicy({ ...request, source_references: [null] as any } as ResearchRequest, selection).allowed, false);
  assert.equal(validatePolicy({ ...request, source_references: [{ id: '1' }] as any } as ResearchRequest, selection).allowed, false);
  assert.equal(validatePolicy({ ...request, source_references: [{ id: '1', uri: '' }] as any } as ResearchRequest, selection).allowed, false);
  assert.equal(validatePolicy({ ...request, source_references: [{ id: '1', uri: '2', extra: true }] as any } as ResearchRequest, selection).allowed, false);
});

test('accepts a valid request and rejects unknown or canonical-write fields', () => {
  assert.deepEqual(validatePolicy(request, selection), { allowed: true });
  assert.equal(validatePolicy({ ...request, extra: true } as any, selection).allowed, false);
  assert.equal(validatePolicy({ ...request, workflow_intent: 'write-canonical' } as any, selection).allowed, false);
  assert.equal(validatePolicy({ ...request, provider_opt_in: { provider: 'openai', model: selection.model } }, selection).allowed, false);
});

test('canonical serialization and SHA-256 are deterministic', () => {
  assert.equal(canonicalSerialize({ z: 1, a: { d: 2, c: 1 } }), '{"a":{"c":1,"d":2},"z":1}');
  assert.equal(sha256('answer'), sha256('answer'));
  assert.notEqual(sha256('answer'), sha256('different'));
});

test('builds receipts for every closed outcome with request and output hashes', () => {
  for (const outcome of ['accepted', 'rejected', 'timed_out', 'indeterminate'] as const) {
    const receipt = buildReceipt(request, { ...result, outcome }, { policy_version: 'v1', adapter_version: 'v1', created_at: '2026-09-07T00:00:00Z' });
    assert.equal(receipt.outcome, outcome);
    assert.equal(receipt.input_hash, sha256(request.input));
    assert.equal(receipt.output_hash, sha256(result.draft_output));
  }
});
