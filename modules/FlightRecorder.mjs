import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const GENESIS_HASH = '0'.repeat(64);

/**
 * Deterministically canonicalize values by recursively sorting object keys
 */
export function canonicalizeValue(val) {
  if (val === null || typeof val !== 'object') return val;
  if (val instanceof Date) return val.toISOString();
  if (Array.isArray(val)) return val.map(canonicalizeValue);
  const sorted = {};
  for (const k of Object.keys(val).sort()) {
    sorted[k] = canonicalizeValue(val[k]);
  }
  return sorted;
}

/**
 * Computes deterministic SHA-256 entry hash over sequence, timestamp, type, payload, and prevHash
 */
export function computeEntryHash({ sequenceNumber, timestamp, eventType, payload, prevHash }) {
  const canonicalPayload = canonicalizeValue(payload);
  const payloadStr = JSON.stringify(canonicalPayload);
  const raw = `${sequenceNumber}\n${timestamp}\n${eventType}\n${payloadStr}\n${prevHash}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/**
 * Computes HMAC-SHA256 signature sealing an entry hash with the recorder secret key
 */
export function computeSignature(entryHash, secretKey) {
  return crypto.createHmac('sha256', secretKey).update(entryHash).digest('hex');
}

/**
 * Constant-time signature verification preventing timing side-channel attacks
 */
export function verifySignature(entryHash, signature, secretKey) {
  if (!signature || typeof signature !== 'string') return false;
  const expected = computeSignature(entryHash, secretKey);
  const bufA = Buffer.from(signature, 'utf8');
  const bufB = Buffer.from(expected, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Append-only, tamper-proof flight recorder and audit trail for agent actions and tool invocations.
 */
export class FlightRecorder {
  constructor(options = {}) {
    this.secretKey = options.secretKey || process.env.TOOLFORGE_RECORDER_SECRET || 'default-toolforge-flight-recorder-secret';
    this.logFilePath = options.logFilePath ? path.resolve(options.logFilePath) : null;
    this.records = [];

    if (this.logFilePath && fs.existsSync(this.logFilePath)) {
      this._loadAndVerifyExistingLog();
    } else {
      this.sequenceNumber = 0;
      this.headHash = GENESIS_HASH;
      if (this.logFilePath) {
        const dir = path.dirname(this.logFilePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      }
    }
  }

  _loadAndVerifyExistingLog() {
    const content = fs.readFileSync(this.logFilePath, 'utf8').trim();
    if (!content) {
      this.sequenceNumber = 0;
      this.headHash = GENESIS_HASH;
      return;
    }

    const lines = content.split('\n').filter(Boolean);
    const parsed = lines.map((line, idx) => {
      try {
        return JSON.parse(line);
      } catch (err) {
        throw new Error(`FLIGHT_RECORDER_INTEGRITY_VIOLATION: Unparseable record at line ${idx + 1}: ${err.message}`);
      }
    });

    const verification = this.verifyIntegrity(parsed, { strict: false });
    if (!verification.valid) {
      throw new Error(`FLIGHT_RECORDER_INTEGRITY_VIOLATION: ${verification.error} at sequence index ${verification.brokenIndex} (${verification.details})`);
    }

    this.records = parsed;
    this.sequenceNumber = parsed.length;
    this.headHash = parsed.length > 0 ? parsed[parsed.length - 1].entryHash : GENESIS_HASH;
  }

  get size() {
    return this.records.length;
  }

  getRecords() {
    return [...this.records];
  }

  /**
   * Append an event to the tamper-proof ledger
   */
  recordEvent({ eventType, payload = {}, timestamp = new Date().toISOString() }) {
    if (!eventType || typeof eventType !== 'string') {
      throw new Error('eventType is required and must be a string');
    }

    const sequenceNumber = this.sequenceNumber;
    const prevHash = this.headHash;
    const canonicalPayload = canonicalizeValue(payload);

    const entryHash = computeEntryHash({
      sequenceNumber,
      timestamp,
      eventType,
      payload: canonicalPayload,
      prevHash
    });

    const signature = computeSignature(entryHash, this.secretKey);

    const record = Object.freeze({
      sequenceNumber,
      timestamp,
      eventType,
      payload: canonicalPayload,
      prevHash,
      entryHash,
      signature
    });

    this.records.push(record);
    this.headHash = entryHash;
    this.sequenceNumber++;

    if (this.logFilePath) {
      fs.appendFileSync(this.logFilePath, JSON.stringify(record) + '\n', 'utf8');
    }

    return record;
  }

  /**
   * Helper to record tool invocation and execution details
   */
  recordToolInvocation({
    toolName,
    params = {},
    agentId = null,
    sessionId = null,
    gateId = null,
    reversibility = null,
    status = 'INVOKED',
    result = null,
    error = null,
    durationMs = null
  }) {
    return this.recordEvent({
      eventType: 'TOOL_INVOCATION',
      payload: {
        toolName,
        params,
        agentId,
        sessionId,
        gateId,
        reversibility,
        status,
        result,
        error: error ? (error.message || String(error)) : null,
        durationMs
      }
    });
  }

  /**
   * Helper to record execution gate decisions
   */
  recordGateDecision({
    gateId,
    toolName,
    decision,
    reversibility = null,
    reason = null,
    token = null
  }) {
    return this.recordEvent({
      eventType: 'GATE_DECISION',
      payload: {
        gateId,
        toolName,
        decision,
        reversibility,
        reason,
        token: token ? `${token.slice(0, 10)}...` : null
      }
    });
  }

  /**
   * Verify integrity of the entire cryptographic hash chain
   */
  verifyIntegrity(records = this.records, { strict = false } = {}) {
    for (let i = 0; i < records.length; i++) {
      const record = records[i];

      // 1. Verify sequence continuity
      if (record.sequenceNumber !== i) {
        const failure = {
          valid: false,
          brokenIndex: i,
          error: 'SEQUENCE_GAP',
          details: `Expected sequence ${i}, found ${record.sequenceNumber}`
        };
        if (strict) throw new Error(`${failure.error}: ${failure.details}`);
        return failure;
      }

      // 2. Verify previous hash chaining
      const expectedPrevHash = i === 0 ? GENESIS_HASH : records[i - 1].entryHash;
      if (record.prevHash !== expectedPrevHash) {
        const failure = {
          valid: false,
          brokenIndex: i,
          error: 'PREV_HASH_MISMATCH',
          details: `PrevHash mismatch at index ${i}`
        };
        if (strict) throw new Error(`${failure.error}: ${failure.details}`);
        return failure;
      }

      // 3. Verify entry payload hash
      const expectedEntryHash = computeEntryHash({
        sequenceNumber: record.sequenceNumber,
        timestamp: record.timestamp,
        eventType: record.eventType,
        payload: record.payload,
        prevHash: record.prevHash
      });

      if (record.entryHash !== expectedEntryHash) {
        const failure = {
          valid: false,
          brokenIndex: i,
          error: 'HASH_MISMATCH',
          details: `Hash tampered at sequence ${i}`
        };
        if (strict) throw new Error(`${failure.error}: ${failure.details}`);
        return failure;
      }

      // 4. Verify HMAC signature sealing
      const validSig = verifySignature(record.entryHash, record.signature, this.secretKey);
      if (!validSig) {
        const failure = {
          valid: false,
          brokenIndex: i,
          error: 'SIGNATURE_MISMATCH',
          details: `Signature forgery or key mismatch at sequence ${i}`
        };
        if (strict) throw new Error(`${failure.error}: ${failure.details}`);
        return failure;
      }
    }

    return {
      valid: true,
      count: records.length,
      headHash: records.length > 0 ? records[records.length - 1].entryHash : GENESIS_HASH
    };
  }

  /**
   * Query recorded events with flexible filters
   */
  query({
    eventType = null,
    toolName = null,
    agentId = null,
    fromSeq = null,
    toSeq = null,
    limit = null
  } = {}) {
    let results = this.records;

    if (eventType) {
      results = results.filter(r => r.eventType === eventType);
    }
    if (toolName) {
      results = results.filter(r => r.payload && r.payload.toolName === toolName);
    }
    if (agentId) {
      results = results.filter(r => r.payload && r.payload.agentId === agentId);
    }
    if (fromSeq !== null) {
      results = results.filter(r => r.sequenceNumber >= fromSeq);
    }
    if (toSeq !== null) {
      results = results.filter(r => r.sequenceNumber <= toSeq);
    }
    if (limit !== null && limit > 0) {
      results = results.slice(0, limit);
    }

    return results;
  }

  /**
   * Static helper to verify a persistent log file from disk
   */
  static verifyLogFile(filePath, secretKey = process.env.TOOLFORGE_RECORDER_SECRET || 'default-toolforge-flight-recorder-secret') {
    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved)) {
      throw new Error(`Log file not found: ${resolved}`);
    }
    const content = fs.readFileSync(resolved, 'utf8').trim();
    if (!content) {
      return { valid: true, count: 0, headHash: GENESIS_HASH };
    }
    const records = content.split('\n').filter(Boolean).map(line => JSON.parse(line));
    const recorder = new FlightRecorder({ secretKey });
    return recorder.verifyIntegrity(records);
  }
}

export const TamperProofFlightRecorder = FlightRecorder;
