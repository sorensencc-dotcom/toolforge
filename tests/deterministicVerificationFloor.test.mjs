import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { DeterministicVerificationFloor, canonicalizeJson } from '../modules/DeterministicVerificationFloor.mjs';

console.log('[test] Running DeterministicVerificationFloor test suite...');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'floor-test-'));
const floor = new DeterministicVerificationFloor(tempDir);

try {
  // --- Test 1: Path Containment & Traversal Prevention ---
  console.log('[test] 1. Testing path boundary and traversal protection...');
  const validFile = path.join(tempDir, 'valid.txt');
  fs.writeFileSync(validFile, 'hello world\n', 'utf8');

  // Should resolve valid file
  const resolved = floor.resolveSafePath('valid.txt');
  assert.equal(resolved, fs.realpathSync(validFile));

  // Should allow non-existent target when option is enabled
  const nonExistent = floor.resolveSafePath('future/nested/file.json', { allowNonExistent: true });
  assert.ok(nonExistent.startsWith(fs.realpathSync(tempDir)));

  // Should reject relative traversal escaping root
  assert.throws(() => {
    floor.resolveSafePath('../outside.txt', { allowNonExistent: true });
  }, /BOUNDARY_VIOLATION/);

  // Should reject null-byte injection
  assert.throws(() => {
    floor.resolveSafePath('valid.txt\0/etc/passwd');
  }, /SECURITY_VIOLATION/);

  // --- Test 2: Span SHA-256 Hash Verification ---
  console.log('[test] 2. Testing span SHA-256 hash assertions...');
  const sampleText = 'Deterministic floor verification invariant.';
  const sampleFile = path.join(tempDir, 'sample.txt');
  fs.writeFileSync(sampleFile, sampleText, 'utf8');

  // Slice "Deterministic" (bytes 0 to 13)
  const expectedHash = crypto.createHash('sha256').update('Deterministic').digest('hex');
  assert.ok(floor.verifySpanHash('sample.txt', 0, 13, expectedHash));

  // Should reject hash mismatch
  assert.throws(() => {
    floor.verifySpanHash('sample.txt', 0, 13, '0000000000000000000000000000000000000000000000000000000000000000');
  }, /SPAN_HASH_MISMATCH/);

  // Should reject invalid offsets
  assert.throws(() => {
    floor.verifySpanHash('sample.txt', -1, 10, expectedHash);
  }, /BOUNDS_ERROR/);

  assert.throws(() => {
    floor.verifySpanHash('sample.txt', 10, 5, expectedHash);
  }, /BOUNDS_ERROR/);

  assert.throws(() => {
    floor.verifySpanHash('sample.txt', 0, 1000, expectedHash);
  }, /BOUNDS_ERROR/);

  // Open safe file descriptor test
  const safeHandle = floor.openSafeFile('sample.txt');
  assert.ok(floor.verifySpanHash(safeHandle.fd, 0, 13, expectedHash));
  safeHandle.close();

  // Multi-byte UTF-8 test (Chinese characters + emojis)
  const unicodeText = '🛡️ 安全验证 Invariant 🎯';
  const unicodeFile = path.join(tempDir, 'unicode.txt');
  fs.writeFileSync(unicodeFile, unicodeText, 'utf8');

  // UTF-8 bytes slice
  const unicodeBuf = Buffer.from(unicodeText, 'utf8');
  const byteSliceExpected = crypto.createHash('sha256').update(unicodeBuf.subarray(0, 13)).digest('hex');
  assert.ok(floor.verifySpanHash('unicode.txt', 0, 13, byteSliceExpected, { unit: 'utf8-bytes' }));

  // UTF-16 code units slice
  const charSliceExpected = crypto.createHash('sha256').update(unicodeText.slice(0, 5), 'utf8').digest('hex');
  assert.ok(floor.verifySpanHash('unicode.txt', 0, 5, charSliceExpected, { unit: 'utf16-code-units' }));

  // Invalid expectedSha256 type check
  assert.throws(() => {
    floor.verifySpanHash('sample.txt', 0, 13, null);
  }, /HASH_INVALID/);

  // --- Test 3: RFC 8785 Canonical JSON Serialization ---
  console.log('[test] 3. Testing RFC 8785 JCS canonicalization...');
  const unorderedA = { z: 1, a: 2, m: { b: 3, a: 4 } };
  const unorderedB = { a: 2, m: { a: 4, b: 3 }, z: 1 };
  
  const jcsA = canonicalizeJson(unorderedA);
  const jcsB = canonicalizeJson(unorderedB);
  assert.equal(jcsA, '{"a":2,"m":{"a":4,"b":3},"z":1}');
  assert.equal(jcsA, jcsB);

  const hashA = floor.computeActionHash(unorderedA);
  const hashB = floor.computeActionHash(unorderedB);
  assert.equal(hashA, hashB);

  // -0 normalization check
  assert.equal(canonicalizeJson({ num: -0 }), '{"num":0}');

  // --- Test 4: Trace Telemetry Assertions ---
  console.log('[test] 4. Testing trace telemetry assertions...');
  const validTelemetry = [
    { id: 'span-1', tag: 'READ_ONLY', exitCode: 0 },
    { id: 'span-2', tag: 'MUTATING', exitCode: 0, walRecordId: 'wal-001' },
  ];
  assert.ok(floor.assertTraceTelemetry(validTelemetry));

  // Should reject missing exitCode / non-zero exitCode
  assert.throws(() => {
    floor.assertTraceTelemetry([{ id: 'span-fail', tag: 'READ_ONLY', exitCode: 1 }]);
  }, /EXECUTION_FAILURE/);

  assert.throws(() => {
    floor.assertTraceTelemetry([{ id: 'span-missing-code', tag: 'READ_ONLY' }]);
  }, /INVALID_EXIT_CODE/);

  // Should reject untagged span
  assert.throws(() => {
    floor.assertTraceTelemetry([{ id: 'span-untagged', tag: 'UNKNOWN', exitCode: 0 }]);
  }, /UNTAGGED_SPAN/);

  // Should reject mutating span without WAL record
  assert.throws(() => {
    floor.assertTraceTelemetry([{ id: 'span-unlogged', tag: 'MUTATING', exitCode: 0 }]);
  }, /WAL_VIOLATION/);

  console.log('[test] ✓ All DeterministicVerificationFloor tests PASSED (100%).');
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
