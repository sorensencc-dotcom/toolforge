import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  FlightRecorder,
  TamperProofFlightRecorder,
  GENESIS_HASH,
  computeEntryHash,
  computeSignature,
  canonicalizeValue
} from '../modules/FlightRecorder.mjs';

test('FlightRecorder - exports canonical GENESIS_HASH and aliases', () => {
  assert.equal(GENESIS_HASH, '0000000000000000000000000000000000000000000000000000000000000000');
  assert.equal(FlightRecorder, TamperProofFlightRecorder);
});

test('FlightRecorder - basic append and cryptographic hash chaining', () => {
  const recorder = new FlightRecorder({ secretKey: 'test-secret' });
  assert.equal(recorder.size, 0);

  const e0 = recorder.recordEvent({
    eventType: 'TOOL_INVOCATION',
    payload: { toolName: 'read_file', params: { path: 'package.json' } }
  });

  assert.equal(e0.sequenceNumber, 0);
  assert.equal(e0.prevHash, GENESIS_HASH);
  assert.ok(e0.entryHash);
  assert.ok(e0.signature);
  assert.equal(recorder.size, 1);
  assert.equal(recorder.headHash, e0.entryHash);

  const e1 = recorder.recordEvent({
    eventType: 'TOOL_INVOCATION',
    payload: { toolName: 'write_file', params: { path: 'test.txt' } }
  });

  assert.equal(e1.sequenceNumber, 1);
  assert.equal(e1.prevHash, e0.entryHash);
  assert.ok(e1.entryHash);
  assert.notEqual(e1.entryHash, e0.entryHash);
  assert.equal(recorder.size, 2);
  assert.equal(recorder.headHash, e1.entryHash);

  const integrity = recorder.verifyIntegrity();
  assert.equal(integrity.valid, true);
  assert.equal(integrity.count, 2);
  assert.equal(integrity.headHash, e1.entryHash);
});

test('FlightRecorder - tamper detection: modified payload breaks hash verification', () => {
  const recorder = new FlightRecorder({ secretKey: 'test-secret' });
  recorder.recordEvent({ eventType: 'EVENT_A', payload: { data: 'a' } });
  recorder.recordEvent({ eventType: 'EVENT_B', payload: { data: 'b' } });
  recorder.recordEvent({ eventType: 'EVENT_C', payload: { data: 'c' } });

  assert.equal(recorder.verifyIntegrity().valid, true);

  // Tamper with record 1 payload in-memory
  const rawRecords = recorder.getRecords();
  rawRecords[1].payload.data = 'hacked';

  const check = recorder.verifyIntegrity(rawRecords);
  assert.equal(check.valid, false);
  assert.equal(check.brokenIndex, 1);
  assert.equal(check.error, 'HASH_MISMATCH');
});

test('FlightRecorder - tamper detection: deleted record causes sequence gap or hash mismatch', () => {
  const recorder = new FlightRecorder({ secretKey: 'test-secret' });
  recorder.recordEvent({ eventType: 'STEP_0', payload: { val: 0 } });
  recorder.recordEvent({ eventType: 'STEP_1', payload: { val: 1 } });
  recorder.recordEvent({ eventType: 'STEP_2', payload: { val: 2 } });

  const rawRecords = [...recorder.getRecords()];
  // Remove step 1
  rawRecords.splice(1, 1);

  const check = recorder.verifyIntegrity(rawRecords);
  assert.equal(check.valid, false);
  assert.equal(check.brokenIndex, 1);
  assert.equal(check.error, 'SEQUENCE_GAP');
});

test('FlightRecorder - tamper detection: forged signature is rejected', () => {
  const recorder = new FlightRecorder({ secretKey: 'legitimate-secret' });
  const e = recorder.recordEvent({ eventType: 'CRITICAL', payload: { root: true } });

  const rawRecords = [JSON.parse(JSON.stringify(e))];
  // Forge signature with attacker key
  rawRecords[0].signature = computeSignature(rawRecords[0].entryHash, 'attacker-secret');

  const check = recorder.verifyIntegrity(rawRecords);
  assert.equal(check.valid, false);
  assert.equal(check.brokenIndex, 0);
  assert.equal(check.error, 'SIGNATURE_MISMATCH');
});

test('FlightRecorder - persistent file logging and seamless resumption', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flight-recorder-test-'));
  const logFile = path.join(tmpDir, 'audit.jsonl');

  try {
    // First session
    const recorder1 = new FlightRecorder({ logFilePath: logFile, secretKey: 'secret-123' });
    recorder1.recordEvent({ eventType: 'SESSION_START', payload: { sessionId: 's-1' } });
    recorder1.recordToolInvocation({
      toolName: 'read_file',
      params: { file: 'foo.js' },
      status: 'SUCCESS',
      result: { size: 100 }
    });

    assert.equal(recorder1.size, 2);
    assert.equal(fs.existsSync(logFile), true);

    const lines = fs.readFileSync(logFile, 'utf8').trim().split('\n');
    assert.equal(lines.length, 2);

    // Verify file statically
    const fileAudit = FlightRecorder.verifyLogFile(logFile, 'secret-123');
    assert.equal(fileAudit.valid, true);
    assert.equal(fileAudit.count, 2);

    // Second session: resumes from existing file
    const recorder2 = new FlightRecorder({ logFilePath: logFile, secretKey: 'secret-123' });
    assert.equal(recorder2.size, 2);
    assert.equal(recorder2.headHash, recorder1.headHash);

    const e2 = recorder2.recordGateDecision({
      gateId: 'gate-xyz',
      toolName: 'git_push',
      decision: 'ALLOWED',
      reversibility: 'IRREVERSIBLE',
      reason: 'Token confirmed'
    });

    assert.equal(e2.sequenceNumber, 2);
    assert.equal(recorder2.size, 3);

    const reAudit = FlightRecorder.verifyLogFile(logFile, 'secret-123');
    assert.equal(reAudit.valid, true);
    assert.equal(reAudit.count, 3);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('FlightRecorder - refuses to resume from corrupted or tampered log file', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flight-corrupt-test-'));
  const logFile = path.join(tmpDir, 'corrupt.jsonl');

  try {
    const recorder = new FlightRecorder({ logFilePath: logFile, secretKey: 'my-secret' });
    recorder.recordEvent({ eventType: 'EVT_0', payload: { msg: 'first' } });
    recorder.recordEvent({ eventType: 'EVT_1', payload: { msg: 'second' } });

    // Tamper with file directly on disk
    const content = fs.readFileSync(logFile, 'utf8');
    const corruptedContent = content.replace('second', 'corrupted');
    fs.writeFileSync(logFile, corruptedContent, 'utf8');

    // Attempting to resume must fail
    assert.throws(() => {
      new FlightRecorder({ logFilePath: logFile, secretKey: 'my-secret' });
    }, /FLIGHT_RECORDER_INTEGRITY_VIOLATION/);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('FlightRecorder - payload key order invariance via canonicalization', () => {
  const hash1 = computeEntryHash({
    sequenceNumber: 0,
    timestamp: '2026-10-13T00:00:00.000Z',
    eventType: 'TOOL',
    payload: { a: 1, b: 2, c: { x: 10, y: 20 } },
    prevHash: GENESIS_HASH
  });

  const hash2 = computeEntryHash({
    sequenceNumber: 0,
    timestamp: '2026-10-13T00:00:00.000Z',
    eventType: 'TOOL',
    payload: { c: { y: 20, x: 10 }, b: 2, a: 1 },
    prevHash: GENESIS_HASH
  });

  assert.equal(hash1, hash2);
});

test('FlightRecorder - query filtering by eventType, toolName, and sequence range', () => {
  const recorder = new FlightRecorder();
  recorder.recordToolInvocation({ toolName: 'read_file', params: { file: 'a' } });
  recorder.recordToolInvocation({ toolName: 'write_file', params: { file: 'b' } });
  recorder.recordGateDecision({ gateId: 'g1', toolName: 'git_push', decision: 'BLOCKED' });
  recorder.recordToolInvocation({ toolName: 'read_file', params: { file: 'c' } });

  const readInvocations = recorder.query({ toolName: 'read_file' });
  assert.equal(readInvocations.length, 2);

  const gateDecisions = recorder.query({ eventType: 'GATE_DECISION' });
  assert.equal(gateDecisions.length, 1);
  assert.equal(gateDecisions[0].payload.gateId, 'g1');

  const seqRange = recorder.query({ fromSeq: 1, toSeq: 2 });
  assert.equal(seqRange.length, 2);
  assert.equal(seqRange[0].sequenceNumber, 1);
  assert.equal(seqRange[1].sequenceNumber, 2);
});

test('FlightRecorder - integrates directly with OneWayDoorInterceptor', async () => {
  const { OneWayDoorInterceptor, generateConfirmationToken } = await import('../modules/OneWayDoorActionGate.mjs');
  const recorder = new FlightRecorder();
  const interceptor = new OneWayDoorInterceptor({ flightRecorder: recorder });

  // 1. Reversible call allowed
  await interceptor.intercept({ toolName: 'read_file', params: { path: 'foo.txt' } });
  assert.equal(recorder.size, 1);
  assert.equal(recorder.records[0].eventType, 'GATE_DECISION');
  assert.equal(recorder.records[0].payload.decision, 'ALLOWED');

  // 2. Irreversible call blocked without token
  const blocked = await interceptor.intercept({ toolName: 'delete_file', params: { path: 'bar.txt' } });
  assert.equal(recorder.size, 2);
  assert.equal(recorder.records[1].payload.decision, 'BLOCKED_BY_GATE');

  // 3. Irreversible call with valid token allowed
  const token = generateConfirmationToken(blocked.gateId);
  await interceptor.intercept({ toolName: 'delete_file', params: { path: 'bar.txt' }, confirmationToken: token });
  assert.equal(recorder.size, 3);
  assert.equal(recorder.records[2].payload.decision, 'ALLOWED');

  const check = recorder.verifyIntegrity();
  assert.equal(check.valid, true);
  assert.equal(check.count, 3);
});

