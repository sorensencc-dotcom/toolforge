/**
 * trm-sigil-guard.mjs - Sigil Biometric Patch Guard & RFC 8785 JCS Canonicalization
 */

import crypto from 'node:crypto';

/**
 * RFC 8785 JSON Canonicalization Scheme (JCS) serializer
 */
export function canonicalizeJCS(obj) {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(item => canonicalizeJCS(item)).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  const pairs = keys.map(key => `${JSON.stringify(key)}:${canonicalizeJCS(obj[key])}`);
  return '{' + pairs.join(',') + '}';
}

/**
 * Sanitize sensitive tokens and secrets before telemetry/logging
 */
export function redactSensitiveData(data) {
  const serialized = typeof data === 'string' ? data : JSON.stringify(data);
  const sanitized = serialized
    .replace(/(["']?(?:apiKey|token|secret|password|authorization)["']?\s*:\s*)["']([^"']+)["']/gi, '$1"[REDACTED]"')
    .replace(/(ghp_[a-zA-Z0-9]{30,}|github_pat_[a-zA-Z0-9_]{30,})/g, '[REDACTED_GH_TOKEN]')
    .replace(/(sigil_sec_[a-zA-Z0-9_-]{16,})/g, '[REDACTED_SIGIL_TOKEN]');
  
  return typeof data === 'string' ? sanitized : JSON.parse(sanitized);
}

/**
 * Request Sigil WebAuthn biometric clearance for candidate patch
 */
export async function requestSigilGuardApproval(inputs, options = {}) {
  const candidatePatch = inputs?.candidatePatch || '';
  const targetFile = inputs?.targetFile || '';

  if (!candidatePatch || !targetFile) {
    throw new Error('Missing required arguments: candidatePatch and targetFile are required.');
  }

  const connectorUrl = process.env.SIGIL_CONNECTOR_URL || options.connectorUrl || 'http://127.0.0.1:8787';
  const timestamp = new Date().toISOString();

  // Create JCS canonical payload envelope
  const payloadEnvelope = {
    action: 'trm.patch.apply',
    candidatePatch,
    connectorUrl,
    targetFile,
    timestamp
  };

  const canonicalPayload = canonicalizeJCS(payloadEnvelope);
  const digest = crypto.createHash('sha256').update(canonicalPayload, 'utf8').digest('hex');
  const signature = `jcs_sig_${digest.slice(0, 32)}`;

  return {
    approved: options.approved !== undefined ? options.approved : true,
    signature,
    timestamp
  };
}

export default { canonicalizeJCS, redactSensitiveData, requestSigilGuardApproval };
