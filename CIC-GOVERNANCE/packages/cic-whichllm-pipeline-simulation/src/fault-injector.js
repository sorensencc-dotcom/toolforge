/**
 * Deterministic Fault Injector for Simulation Harness
 */
import { createHash } from 'node:crypto';

export class FaultInjector {
  static corruptHash(hash) {
    if (!hash || hash.length !== 64) throw new Error('Invalid hash for corruption');
    const inverted = (parseInt(hash[0], 16) ^ 0xf).toString(16);
    return inverted + hash.slice(1);
  }

  static truncateBuffer(buf, maxBytes = 2048) {
    const raw = Buffer.isBuffer(buf) ? buf : Buffer.from(buf, 'utf8');
    return raw.subarray(0, Math.min(raw.length, maxBytes));
  }

  static injectPayloadOffsetFault(jsonString, offset = 512) {
    const buf = Buffer.from(jsonString, 'utf8');
    if (buf.length <= offset) return buf.toString('utf8');
    buf[offset] = 0x00; // inject null byte
    return buf.toString('utf8');
  }
}
