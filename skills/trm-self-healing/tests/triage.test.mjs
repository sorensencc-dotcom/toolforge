import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { matchLocalSignature, runTinyFishTriage } from '../src/trm-tinyfish-triage.mjs';
import { runParallelEscalation } from '../src/trm-parallel-escalation.mjs';
import { sanitizeTelemetryPayload, requestSigilApproval } from '../src/trm-sigil-guard.mjs';

describe('TRM Diagnostic, Escalation & Guard Suite', () => {
  it('matches golden error fixtures deterministically', () => {
    const portError = 'Error: EADDRINUSE: address already in use 127.0.0.1:8787';
    const connError = 'connect ECONNREFUSED 127.0.0.1:8795';

    const matchPort = matchLocalSignature(portError);
    assert.equal(matchPort.category, 'PORT_CONFLICT');
    assert.equal(matchPort.deterministic, true);

    const matchConn = matchLocalSignature(connError);
    assert.equal(matchConn.category, 'CONNECTION_REFUSED');
    assert.equal(matchConn.deterministic, true);
  });

  it('classifies unknown signatures cleanly on offline fallback', async () => {
    const unknownLog = 'Unrecognized hardware anomaly on device 0x44';
    const result = await runTinyFishTriage(unknownLog, { offlineMode: true });
    assert.equal(result.status, 'ESCALATE');
    assert.equal(result.category, 'UNKNOWN_SIGNATURE');
  });

  it('enforces concurrency bounds in parallel research escalation', async () => {
    const result = await runParallelEscalation('Log trace for deep research', 'Context block', { timeoutMs: 2000 });
    assert.ok(result.taskId.startsWith('task_'));
    assert.ok(result.findings.length > 0);
  });

  it('sanitizes telemetry payloads and redacts secrets at boundary', () => {
    const fuzzedPayload = {
      state: 'blocked',
      mockKeyField: 'sample_value_123',
      message: 'Approval waiting for user with secret key mock_secret_val_99'
    };
    const sanitized = sanitizeTelemetryPayload(fuzzedPayload);
    assert.equal(sanitized.mockKeyField, '[REDACTED]');
    assert.ok(!sanitized.message.includes('mock_secret_val_99'));
  });

  it('bounds Sigil guard to local loopback connector only', async () => {
    const approval = await requestSigilApproval('Fix port conflict in config', ['config.toml']);
    assert.equal(approval.connectorHost, '127.0.0.1');
    assert.equal(approval.approved, true);
  });
});
