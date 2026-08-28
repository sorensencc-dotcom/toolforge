import test from 'node:test';
import assert from 'node:assert/strict';
import { ContractValidationError, validateRequest, validateResponse } from './viking-vfs-contracts.mjs';

const uri = 'viking://kb-sync/wiki/concepts/reconnect.md';
const request = (method, params = {}) => ({ jsonrpc: '2.0', id: 1, method, params });
const success = (result) => ({ jsonrpc: '2.0', id: 1, result });
const error = { jsonrpc: '2.0', id: 1, error: { code: 'RESOURCE_NOT_FOUND', message: 'missing', data: {} } };

test('accepts initialize and method-specific list/stat/read requests', () => {
  for (const value of [
    request('initialize', { protocolVersion: '2025-06-18' }),
    request('viking/list', { uri, offset: 0, limit: 10 }),
    request('viking/stat', { uri }),
    request('viking/read', { uri, resolution_tier: 'L1' }),
  ]) assert.deepEqual(validateRequest(value), value);
});

test('rejects malformed requests and invalid method parameters', () => {
  const cases = [
    [{ ...request('initialize'), jsonrpc: '1.0' }, '$.jsonrpc'],
    [request('viking/stat', { uri: 'file:///tmp/x' }), '$.params.uri'],
    [request('viking/list', { uri, limit: 101 }), '$.params.limit'],
    [request('viking/read', { uri, resolution_tier: 'L3' }), '$.params.resolution_tier'],
    [request('viking/stat', { uri, extra: true }), '$.params.extra'],
  ];
  for (const [value, path] of cases) assert.throws(() => validateRequest(value), (err) => err instanceof ContractValidationError && err.path === path);
});

test('accepts success envelopes and validates required result identity', () => {
  assert.deepEqual(validateResponse(success({ uri, snapshot_id: '20260828-010000', content: 'text' })), { uri, snapshot_id: '20260828-010000', content: 'text' });
  assert.throws(() => validateResponse(success({ uri })), /non-empty string/);
});

test('accepts error envelopes and rejects malformed or ambiguous envelopes', () => {
  assert.deepEqual(validateResponse(error), error.error);
  assert.throws(() => validateResponse({ ...error, result: {} }), /exactly one/);
  assert.throws(() => validateResponse({ ...error, error: { code: 'X' } }), /non-empty string/);
});
