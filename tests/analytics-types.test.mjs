import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AgentTelemetryEventSchema, validateTelemetryEvent } from '../rewrite-mcp/src/analytics/schema.js';

test('AgentTelemetryEventSchema validates valid telemetry payload', () => {
  const valid = {
    session_id: 'sess-123',
    step_index: 1,
    timestamp: '2026-10-03T12:00:00.000Z',
    agent_role: 'builder',
    model: 'gemini-3.7-flash',
    prompt_tokens: 1500,
    completion_tokens: 400,
    tool_name: 'view_file',
    duration_ms: 320,
    status: 'SUCCESS',
  };

  const result = validateTelemetryEvent(valid);
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.session_id, 'sess-123');
    assert.equal(result.data.status, 'SUCCESS');
  }
});

test('AgentTelemetryEventSchema rejects invalid timestamps and negative tokens', () => {
  const invalid = {
    session_id: 'sess-123',
    step_index: -1,
    timestamp: 'not-a-timestamp',
    agent_role: 'builder',
    model: 'gemini-3.7-flash',
    prompt_tokens: -50,
    status: 'INVALID_STATUS',
  };

  const result = validateTelemetryEvent(invalid);
  assert.equal(result.success, false);
});
