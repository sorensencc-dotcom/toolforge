import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

/**
 * Validates that the provided URL resolves strictly to the local loopback interface.
 * Strictly allows localhost, 127.0.0.1, ::1, and [::1].
 * Throws an Error with SECURITY_BOUNDARY_VIOLATION on external or non-loopback endpoints.
 *
 * @param {string} urlString
 * @returns {boolean}
 */
export function validateLoopbackUrl(urlString) {
  if (typeof urlString !== 'string' || !urlString.trim()) {
    throw new Error('SECURITY_BOUNDARY_VIOLATION: Empty or invalid URL string provided');
  }

  let normalizedUrl = urlString;
  // Normalize bare IPv6 host without brackets in URL (e.g. http://::1:3000)
  normalizedUrl = normalizedUrl.replace(/^(https?:\/\/)(::1)(:\d+)?(\/.*)?$/i, '$1[$2]$3$4');

  let parsed;
  try {
    parsed = new URL(normalizedUrl);
  } catch (err) {
    throw new Error(`SECURITY_BOUNDARY_VIOLATION: Invalid URL format: ${err.message}`);
  }

  const allowedHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
  if (!allowedHosts.has(parsed.hostname)) {
    throw new Error(`SECURITY_BOUNDARY_VIOLATION: Endpoint must resolve to local loopback (127.0.0.1, localhost, or ::1). Got: ${parsed.hostname}`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`SECURITY_BOUNDARY_VIOLATION: Invalid protocol: ${parsed.protocol}`);
  }

  return true;
}

/**
 * Cross-process file lock using atomic openSync('wx').
 * Stores PID and acquiredAt timestamp.
 * Cleans stale locks older than staleThresholdMs.
 */
export class GPULock {
  constructor(lockPath, staleThresholdMs = 65_000) {
    this.lockPath = lockPath || path.join(os.tmpdir(), '.vane-gpu-worker.lock');
    this.staleThresholdMs = staleThresholdMs;
  }

  acquire() {
    this.cleanStale();
    let fd = null;
    try {
      fd = fs.openSync(this.lockPath, 'wx');
      const data = JSON.stringify({ pid: process.pid, acquiredAt: Date.now() });
      fs.writeFileSync(fd, data);
      return true;
    } catch (err) {
      if (err.code === 'EEXIST') return false;
      throw err;
    } finally {
      if (fd !== null) {
        try {
          fs.closeSync(fd);
        } catch (_) {}
      }
    }
  }

  release() {
    try {
      if (fs.existsSync(this.lockPath)) {
        fs.unlinkSync(this.lockPath);
      }
    } catch (_) {}
  }

  cleanStale() {
    try {
      if (!fs.existsSync(this.lockPath)) return;
      let isStale = false;
      try {
        const raw = fs.readFileSync(this.lockPath, 'utf8');
        const parsed = JSON.parse(raw);
        if (typeof parsed.acquiredAt === 'number' && Date.now() - parsed.acquiredAt > this.staleThresholdMs) {
          isStale = true;
        }
      } catch (_) {
        const stat = fs.statSync(this.lockPath);
        if (Date.now() - stat.mtimeMs > this.staleThresholdMs) {
          isStale = true;
        }
      }
      if (isStale) {
        try {
          fs.unlinkSync(this.lockPath);
        } catch (_) {}
      }
    } catch (_) {}
  }
}

/**
 * Finite state machine circuit breaker: CLOSED -> OPEN -> HALF_OPEN.
 * Failure tracking applies exclusively to transport errors.
 */
export class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 3;
    this.cooldownMs = options.cooldownMs || 60_000;
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.lastFailureTime = 0;
  }

  canExecute() {
    const now = Date.now();
    if (this.state === 'OPEN') {
      if (now - this.lastFailureTime > this.cooldownMs) {
        this.state = 'HALF_OPEN';
        return true;
      }
      return false;
    }
    return true;
  }

  recordSuccess() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.lastFailureTime = 0;
  }

  recordFailure(isTransportError) {
    if (!isTransportError) return;
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.state === 'HALF_OPEN' || this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }
}
