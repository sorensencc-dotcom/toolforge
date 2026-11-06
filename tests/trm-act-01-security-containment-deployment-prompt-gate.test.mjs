/**
 * TRM TDD Test Contract: act-01-security-containment-deployment-prompt-gate
 * Intent: Security Containment Deployment Prompt Gate
 * Target: toolforge
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  signScopeManifest,
  verifyScopeManifest,
  verifySocketTargetAllowed,
  createOutOfBandKillGate
} from '../scripts/lib/security-containment-gate.mjs';

test('act-01: verifies HMAC-signed scope manifest and rejects tampered or expired scopes', () => {
  const fixtureHmacKey = 'toolforge-containment-fixture-hmac-2026';
  const manifest = {
    targetScopeId: 'diag-sandbox-01',
    allowedTargets: ['127.0.0.1/32', '10.24.0.0/16', 'api.internal.local'],
    expiresAt: '2026-12-31T00:00:00Z'
  };

  const signature = signScopeManifest(manifest, fixtureHmacKey);
  const validCheck = verifyScopeManifest(manifest, signature, fixtureHmacKey, Date.parse('2026-11-06T12:00:00Z'));
  assert.equal(validCheck.valid, true);

  // Tampered target list must fail closed
  const tampered = { ...manifest, allowedTargets: [...manifest.allowedTargets, '0.0.0.0/0'] };
  const tamperedCheck = verifyScopeManifest(tampered, signature, fixtureHmacKey, Date.parse('2026-11-06T12:00:00Z'));
  assert.equal(tamperedCheck.valid, false);
  assert.equal(tamperedCheck.reason, 'SIGNATURE_MISMATCH');

  // Expired manifest must fail closed
  const expiredCheck = verifyScopeManifest(manifest, signature, fixtureHmacKey, Date.parse('2027-01-02T00:00:00Z'));
  assert.equal(expiredCheck.valid, false);
  assert.equal(expiredCheck.reason, 'SCOPE_EXPIRED');
});

test('act-01: enforces default-deny socket IP/CIDR and hostname allowlist', () => {
  const allowlist = ['127.0.0.1/32', '10.24.0.0/16', 'api.internal.local'];

  assert.equal(verifySocketTargetAllowed('127.0.0.1', allowlist).allowed, true);
  assert.equal(verifySocketTargetAllowed('10.24.15.99', allowlist).allowed, true);
  assert.equal(verifySocketTargetAllowed('api.internal.local', allowlist).allowed, true);

  // Out-of-scope IP and unapproved external host must be denied
  assert.equal(verifySocketTargetAllowed('10.25.0.1', allowlist).allowed, false);
  assert.equal(verifySocketTargetAllowed('8.8.8.8', allowlist).allowed, false);
  assert.equal(verifySocketTargetAllowed('evil.example.com', allowlist).allowed, false);
  assert.equal(verifySocketTargetAllowed('127.0.0.1', []).allowed, false);
});

test('act-01: severs agent process out-of-band via hard kill gate', () => {
  const killedSignals = [];
  const gate = createOutOfBandKillGate({
    pid: 42424,
    maxRuntimeMs: 60000,
    killFn: (pid, signal) => {
      killedSignals.push({ pid, signal });
    }
  });

  try {
    assert.equal(gate.isTerminated, false);
    const result = gate.triggerKill('SCOPE_VIOLATION_EGRESS');
    assert.equal(result.terminated, true);
    assert.equal(result.reason, 'SCOPE_VIOLATION_EGRESS');
    assert.equal(gate.isTerminated, true);
    assert.deepEqual(killedSignals, [{ pid: 42424, signal: 'SIGKILL' }]);
  } finally {
    gate.disarm();
  }
});
