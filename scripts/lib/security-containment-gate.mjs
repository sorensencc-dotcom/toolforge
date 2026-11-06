/**
 * scripts/lib/security-containment-gate.mjs
 *
 * Security Containment & In-Bounds Scope Verification Gate (act-01).
 * Enforces:
 * 1. HMAC-SHA256 cryptographically signed deployment scope manifests.
 * 2. Default-deny socket-level IP/CIDR and hostname allowlisting.
 * 3. Out-of-band external process kill gates that sever execution without
 *    relying on model cooperative shutdown compliance.
 */

import crypto from 'node:crypto';

/**
 * Canonicalizes a scope manifest object for deterministic HMAC signing.
 * @param {object} manifest
 * @returns {string}
 */
export function canonicalizeScopeManifest(manifest) {
  if (!manifest || typeof manifest !== 'object') {
    throw new Error('INVALID_MANIFEST: Scope manifest must be an object.');
  }
  const sortedKeys = Object.keys(manifest).sort();
  const normalized = {};
  for (const key of sortedKeys) {
    if (key === 'signature') continue;
    const val = manifest[key];
    normalized[key] = Array.isArray(val) ? [...val].map(String).sort() : val;
  }
  return JSON.stringify(normalized);
}

/**
 * Signs a deployment scope manifest using HMAC-SHA256.
 * @param {object} manifest
 * @param {string} secret
 * @returns {string} hex digest
 */
export function signScopeManifest(manifest, secret) {
  if (!secret || typeof secret !== 'string' || secret.length < 16) {
    throw new Error('INVALID_SECRET: Signing secret must be at least 16 characters.');
  }
  const payload = canonicalizeScopeManifest(manifest);
  return crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
}

/**
 * Verifies a deployment scope manifest signature and expiration window.
 * @param {object} manifest
 * @param {string} signature
 * @param {string} secret
 * @param {number} [nowMs=Date.now()]
 * @returns {{ valid: boolean, reason?: string }}
 */
export function verifyScopeManifest(manifest, signature, secret, nowMs = Date.now()) {
  if (!manifest || !signature || !secret) {
    return { valid: false, reason: 'MISSING_PARAMETERS' };
  }
  if (!manifest.targetScopeId || !Array.isArray(manifest.allowedTargets) || manifest.allowedTargets.length === 0) {
    return { valid: false, reason: 'EMPTY_SCOPE_BOUNDARY' };
  }
  if (manifest.expiresAt && Number(new Date(manifest.expiresAt).getTime()) <= nowMs) {
    return { valid: false, reason: 'SCOPE_EXPIRED' };
  }
  const expected = signScopeManifest(manifest, secret);
  const sigBuf = Buffer.from(String(signature), 'hex');
  const expBuf = Buffer.from(expected, 'hex');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return { valid: false, reason: 'SIGNATURE_MISMATCH' };
  }
  return { valid: true };
}

function ipv4ToInt(ip) {
  const parts = String(ip).trim().split('.');
  if (parts.length !== 4) return null;
  let num = 0;
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null;
    const octet = Number(part);
    if (octet < 0 || octet > 255) return null;
    num = ((num << 8) | octet) >>> 0;
  }
  return num;
}

function matchesCidr(ip, cidr) {
  const [rangeIp, prefixStr] = String(cidr).split('/');
  const prefix = Number(prefixStr);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return false;
  const ipInt = ipv4ToInt(ip);
  const rangeInt = ipv4ToInt(rangeIp);
  if (ipInt === null || rangeInt === null) return false;
  if (prefix === 0) return true;
  const mask = (0xffffffff << (32 - prefix)) >>> 0;
  return (ipInt & mask) === (rangeInt & mask);
}

/**
 * Default-deny socket-level target allowlist check.
 * @param {string} targetHostOrIp
 * @param {Array<string>} allowedTargets
 * @returns {{ allowed: boolean, matchedRule: string | null }}
 */
export function verifySocketTargetAllowed(targetHostOrIp, allowedTargets = []) {
  const cleanTarget = String(targetHostOrIp || '').trim().toLowerCase().replace(/^\[|\]$/g, '');
  if (!cleanTarget || !Array.isArray(allowedTargets) || allowedTargets.length === 0) {
    return { allowed: false, matchedRule: null };
  }

  for (const rawRule of allowedTargets) {
    const rule = String(rawRule || '').trim().toLowerCase();
    if (!rule) continue;
    if (rule === cleanTarget) {
      return { allowed: true, matchedRule: rule };
    }
    if (rule.includes('/') && matchesCidr(cleanTarget, rule)) {
      return { allowed: true, matchedRule: rule };
    }
  }

  return { allowed: false, matchedRule: null };
}

/**
 * Creates an out-of-band external process kill gate.
 * Severs execution via OS signal/kill callback rather than prompt-level stop requests.
 * @param {object} options
 * @param {number} options.pid
 * @param {number} [options.maxRuntimeMs=60000]
 * @param {(pid: number, signal: string) => void} [options.killFn]
 */
export function createOutOfBandKillGate({ pid, maxRuntimeMs = 60000, killFn = process.kill } = {}) {
  if (!Number.isInteger(pid) || pid <= 0) {
    throw new Error('INVALID_PID: Out-of-band kill gate requires a positive integer PID.');
  }

  let terminated = false;
  let terminationReason = null;
  let terminatedAt = null;

  const triggerKill = (reason = 'OUT_OF_BAND_KILL_GATE') => {
    if (terminated) {
      return { terminated: true, reason: terminationReason, terminatedAt };
    }
    terminated = true;
    terminationReason = reason;
    terminatedAt = new Date().toISOString();
    clearTimeout(timer);
    killFn(pid, 'SIGKILL');
    return { terminated: true, reason: terminationReason, terminatedAt };
  };

  const timer = setTimeout(() => {
    triggerKill('MAX_RUNTIME_EXCEEDED');
  }, maxRuntimeMs);
  if (typeof timer.unref === 'function') timer.unref();

  return {
    get isTerminated() {
      return terminated;
    },
    get reason() {
      return terminationReason;
    },
    triggerKill,
    disarm() {
      clearTimeout(timer);
    }
  };
}
