import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validateLoopbackUrl, GPULock, CircuitBreaker } from '../modules/wiki/vane-infra.mjs';

test('Vane Infrastructure Suite', async (t) => {
  await t.test('1. validateLoopbackUrl enforces loopback origins and protocols', () => {
    // Valid loopback endpoints
    assert.equal(validateLoopbackUrl('http://127.0.0.1:3000'), true);
    assert.equal(validateLoopbackUrl('http://localhost:3000'), true);
    assert.equal(validateLoopbackUrl('http://[::1]:3000'), true);
    assert.equal(validateLoopbackUrl('http://::1:3000'), true);
    assert.equal(validateLoopbackUrl('https://127.0.0.1:8000/api/search'), true);

    // Non-loopback / remote / wildcard hosts must throw SECURITY_BOUNDARY_VIOLATION
    assert.throws(() => validateLoopbackUrl('http://0.0.0.0:3000'), /SECURITY_BOUNDARY_VIOLATION/);
    assert.throws(() => validateLoopbackUrl('http://192.168.1.1:3000'), /SECURITY_BOUNDARY_VIOLATION/);
    assert.throws(() => validateLoopbackUrl('http://example.com:3000'), /SECURITY_BOUNDARY_VIOLATION/);
    assert.throws(() => validateLoopbackUrl('http://10.0.0.1:3000'), /SECURITY_BOUNDARY_VIOLATION/);

    // Invalid protocols and malformed inputs
    assert.throws(() => validateLoopbackUrl('ftp://localhost:3000'), /SECURITY_BOUNDARY_VIOLATION/);
    assert.throws(() => validateLoopbackUrl('not-a-valid-url'), /SECURITY_BOUNDARY_VIOLATION/);
    assert.throws(() => validateLoopbackUrl(''), /SECURITY_BOUNDARY_VIOLATION/);
  });

  await t.test('2. GPULock manages cross-process semaphore and stale recovery', () => {
    const lockPath = path.join(os.tmpdir(), `test-gpu-${Date.now()}-${Math.random().toString(36).slice(2)}.lock`);
    const lock1 = new GPULock(lockPath);
    const lock2 = new GPULock(lockPath);

    try {
      // Basic mutual exclusion
      assert.equal(lock1.acquire(), true);
      assert.equal(lock2.acquire(), false);

      // Verify file content structure
      const raw = fs.readFileSync(lockPath, 'utf8');
      const parsed = JSON.parse(raw);
      assert.equal(parsed.pid, process.pid);
      assert.equal(typeof parsed.acquiredAt, 'number');

      // Release allows re-acquisition
      lock1.release();
      assert.equal(lock2.acquire(), true);
      lock2.release();
    } finally {
      lock1.release();
      lock2.release();
    }
  });

  await t.test('3. GPULock cleanStale evicts expired locks and preserves fresh locks', () => {
    const staleLockPath = path.join(os.tmpdir(), `test-gpu-stale-${Date.now()}.lock`);
    const shortThresholdMs = 50;
    const lock = new GPULock(staleLockPath, shortThresholdMs);

    try {
      // 3a. Active lock should NOT be cleaned
      fs.writeFileSync(staleLockPath, JSON.stringify({ pid: 99999, acquiredAt: Date.now() }));
      lock.cleanStale();
      assert.equal(fs.existsSync(staleLockPath), true);

      // 3b. Expired acquiredAt timestamp gets evicted
      const oldTime = Date.now() - 200;
      fs.writeFileSync(staleLockPath, JSON.stringify({ pid: 99999, acquiredAt: oldTime }));
      lock.cleanStale();
      assert.equal(fs.existsSync(staleLockPath), false);

      // 3c. Corrupted JSON with old mtime gets evicted via fallback
      fs.writeFileSync(staleLockPath, 'INVALID_JSON_CORRUPTED');
      const pastTime = (Date.now() - 200) / 1000;
      fs.utimesSync(staleLockPath, pastTime, pastTime);
      lock.cleanStale();
      assert.equal(fs.existsSync(staleLockPath), false);

      // 3d. Default lockPath initializes cleanly
      const defaultLock = new GPULock();
      assert(defaultLock.lockPath.endsWith('.vane-gpu-worker.lock'));
    } finally {
      try {
        if (fs.existsSync(staleLockPath)) fs.unlinkSync(staleLockPath);
      } catch (_) {}
    }
  });

  await t.test('4. CircuitBreaker transitions CLOSED -> OPEN -> HALF_OPEN -> CLOSED with fault filtering', async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 2, cooldownMs: 30 });
    assert.equal(breaker.state, 'CLOSED');
    assert.equal(breaker.canExecute(), true);

    // Non-transport errors must be ignored by failure tracking
    breaker.recordFailure(false);
    assert.equal(breaker.failureCount, 0);
    assert.equal(breaker.state, 'CLOSED');

    // Transport failures increment failureCount and trigger OPEN state
    breaker.recordFailure(true);
    assert.equal(breaker.failureCount, 1);
    assert.equal(breaker.state, 'CLOSED');

    breaker.recordFailure(true);
    assert.equal(breaker.failureCount, 2);
    assert.equal(breaker.state, 'OPEN');
    assert.equal(breaker.canExecute(), false);

    // Wait for cooldown to expire
    await new Promise((resolve) => setTimeout(resolve, 45));

    // Can execute after cooldown transitions to HALF_OPEN
    assert.equal(breaker.canExecute(), true);
    assert.equal(breaker.state, 'HALF_OPEN');

    // Success in HALF_OPEN resets state to CLOSED, resetting failureCount and lastFailureTime
    breaker.recordSuccess();
    assert.equal(breaker.state, 'CLOSED');
    assert.equal(breaker.failureCount, 0);
    assert.equal(breaker.lastFailureTime, 0);
    assert.equal(breaker.canExecute(), true);
  });

  await t.test('5. CircuitBreaker re-trips immediately on transport failure during HALF_OPEN', async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 1, cooldownMs: 20 });
    breaker.recordFailure(true);
    assert.equal(breaker.state, 'OPEN');

    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(breaker.canExecute(), true);
    assert.equal(breaker.state, 'HALF_OPEN');

    // Failure during HALF_OPEN immediately returns to OPEN
    breaker.recordFailure(true);
    assert.equal(breaker.state, 'OPEN');
    assert.equal(breaker.canExecute(), false);
  });

  await t.test('6. CircuitBreaker initializes with canonical defaults', () => {
    const defaultBreaker = new CircuitBreaker();
    assert.equal(defaultBreaker.failureThreshold, 3);
    assert.equal(defaultBreaker.cooldownMs, 60000);
    assert.equal(defaultBreaker.state, 'CLOSED');
    assert.equal(defaultBreaker.failureCount, 0);
    assert.equal(defaultBreaker.lastFailureTime, 0);
  });
});
