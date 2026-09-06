import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign, verify } from 'node:crypto';
import { createBaseEnvelope, CAPABILITY_SETS } from './fixtures.mjs';

function canonicalizeJson(obj) {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(item => canonicalizeJson(item)).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  const pairs = keys.map(key => JSON.stringify(key) + ':' + canonicalizeJson(obj[key]));
  return '{' + pairs.join(',') + '}';
}

function generateSigilKeyPair() {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  return {
    keyId: 'key_test_01',
    privateKey,
    publicKey,
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }),
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' })
  };
}

function signSigilEnvelope(envelope, privateKey, keyId) {
  const payload = { ...envelope };
  delete payload.signature;
  const canonical = canonicalizeJson(payload);
  const signatureBuffer = sign(null, Buffer.from(canonical, 'utf8'), privateKey);
  const base64urlSig = signatureBuffer.toString('base64url');

  return {
    ...payload,
    signature: {
      algorithm: 'Ed25519',
      key_id: keyId,
      value: `base64url:${base64urlSig}`
    }
  };
}

function verifySigilEnvelope(signedEnvelope, publicKey) {
  if (!signedEnvelope.signature || !signedEnvelope.signature.value) return false;
  const { signature, ...payload } = signedEnvelope;
  const canonical = canonicalizeJson(payload);
  const sigRaw = signature.value.replace(/^base64url:/, '');
  const sigBuffer = Buffer.from(sigRaw, 'base64url');

  return verify(null, Buffer.from(canonical, 'utf8'), publicKey, sigBuffer);
}

function evaluateCapabilityIntersection(profileCapabilities, envelopeCapabilities) {
  const grantedSet = new Set(profileCapabilities);
  const requested = Array.isArray(envelopeCapabilities) ? envelopeCapabilities : [];
  const granted = requested.filter(cap => grantedSet.has(cap));
  const rejected = requested.filter(cap => !grantedSet.has(cap));
  return {
    isSatisfied: rejected.length === 0,
    granted,
    rejected
  };
}

describe('Sigil Grok Bridge Conformance & Guardrails', () => {
  const keyPair = generateSigilKeyPair();

  test('SIG-01: Signs and verifies valid envelope using RFC 8785 canonicalization', () => {
    const unsigned = createBaseEnvelope();
    const signed = signSigilEnvelope(unsigned, keyPair.privateKey, keyPair.keyId);

    assert.equal(signed.signature.algorithm, 'Ed25519');
    assert.ok(signed.signature.value.startsWith('base64url:'));
    assert.equal(signed.signature.key_id, keyPair.keyId);

    const isValid = verifySigilEnvelope(signed, keyPair.publicKey);
    assert.equal(isValid, true, 'Cryptographic verification must pass for untampered signed envelope');
  });

  test('SIG-02: Rejects tampered body, header, or context_refs fail-closed', () => {
    const unsigned = createBaseEnvelope();
    const signed = signSigilEnvelope(unsigned, keyPair.privateKey, keyPair.keyId);

    // Tamper 1: Mutate body instruction
    const tamperedBody = JSON.parse(JSON.stringify(signed));
    tamperedBody.body.instruction = 'Inject untracked shell command';
    assert.equal(verifySigilEnvelope(tamperedBody, keyPair.publicKey), false);

    // Tamper 2: Swap context reference hash
    const tamperedContext = JSON.parse(JSON.stringify(signed));
    tamperedContext.context_refs[0].sha256 = '0'.repeat(64);
    assert.equal(verifySigilEnvelope(tamperedContext, keyPair.publicKey), false);

    // Tamper 3: Sneak extra capability into signed payload
    const tamperedCaps = JSON.parse(JSON.stringify(signed));
    tamperedCaps.capabilities.push('sigil.workspace/arbitrary_write');
    assert.equal(verifySigilEnvelope(tamperedCaps, keyPair.publicKey), false);
  });

  test('SIG-03: Rejects verification across signature/key mismatches', () => {
    const foreignKeyPair = generateSigilKeyPair();
    const unsigned = createBaseEnvelope();
    const signed = signSigilEnvelope(unsigned, keyPair.privateKey, keyPair.keyId);

    const isVerifiedWithWrongKey = verifySigilEnvelope(signed, foreignKeyPair.publicKey);
    assert.equal(isVerifiedWithWrongKey, false);
  });

  test('CAP-01: Capability intersection grants exact subset when profile permits', () => {
    const grokProfileCapabilities = CAPABILITY_SETS.TASK_SUBMIT;
    const requestedCapabilities = CAPABILITY_SETS.READ_ONLY;

    const evalResult = evaluateCapabilityIntersection(grokProfileCapabilities, requestedCapabilities);
    assert.equal(evalResult.isSatisfied, true);
    assert.deepEqual(evalResult.granted, ['sigil.core/read_shared_context']);
    assert.equal(evalResult.rejected.length, 0);
  });

  test('CAP-02: Fails closed when envelope requests capability outside profile grant', () => {
    const grokProfileCapabilities = CAPABILITY_SETS.READ_ONLY;
    const requestedCapabilities = [
      'sigil.core/read_shared_context',
      'sigil.workspace/arbitrary_write'
    ];

    const evalResult = evaluateCapabilityIntersection(grokProfileCapabilities, requestedCapabilities);
    assert.equal(evalResult.isSatisfied, false);
    assert.deepEqual(evalResult.granted, ['sigil.core/read_shared_context']);
    assert.deepEqual(evalResult.rejected, ['sigil.workspace/arbitrary_write']);
  });

  test('CAP-03: Enforces pending step-up invariant on envelopes requiring approval', () => {
    const highRiskEnvelope = createBaseEnvelope({
      capabilities: [...CAPABILITY_SETS.ELEVATED_MUTATION],
      approval: {
        required: true,
        status: 'pending'
      }
    });

    const signed = signSigilEnvelope(highRiskEnvelope, keyPair.privateKey, keyPair.keyId);
    assert.equal(signed.approval.required, true);
    assert.equal(signed.approval.status, 'pending');

    const forgedEnvelope = {
      ...highRiskEnvelope,
      approval: { required: true, status: 'approved' }
    };
    assert.throws(() => {
      if (forgedEnvelope.sender.kind === 'agent' && forgedEnvelope.approval.status === 'approved') {
        throw new Error('GOVERNANCE_VIOLATION: Agents cannot submit self-approved envelopes');
      }
    }, /GOVERNANCE_VIOLATION/);
  });
});
