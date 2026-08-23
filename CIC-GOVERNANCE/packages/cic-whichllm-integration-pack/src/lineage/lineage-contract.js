/**
 * CIC Lineage Contract
 * Spec: CIC v2.4.0 | Amendment §2/S3-A1
 * Pack: CIC-WHICHLLM-INTEGRATION-PACK v1.0
 *
 * Implements an append-only, hash-chained lineage ledger.
 *
 * Chain structure (per §2/S3-A1 §4.2):
 *   entry_n.hash = SHA-256( entry_(n-1).hash || canonical_json(entry_n.payload) )
 *
 * The genesis entry uses a deterministic zero-seed:
 *   GENESIS_HASH = SHA-256("CIC:GENESIS:v2.4.0:§2/S3-A1")
 *
 * Invariants:
 *   1. Entries are immutable after append.
 *   2. The chain can be fully replayed from the genesis seed + payloads.
 *   3. No wall-clock values enter the hash computation (timestamps appear only in
 *      metadata and are excluded from the chain hash).
 */

import { createHash } from 'node:crypto';
import { canonicalJson, deriveId } from '../adapter/whichllm-adapter.js';

// ─── Constants ────────────────────────────────────────────────────────────────

export const LINEAGE_CONTRACT_VERSION = '1.0.0';
const GENESIS_SEED = 'CIC:GENESIS:v2.4.0:§2/S3-A1';

export const GENESIS_HASH = createHash('sha256')
  .update(GENESIS_SEED, 'utf8')
  .digest('hex');

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} StampInput
 * @property {string} queryId        - Stable query identifier
 * @property {string} requestHash    - SHA-256 of canonical request payload
 * @property {string} responseHash   - SHA-256 of canonical response payload
 * @property {string} model          - Model name selected by WHICHLLM
 */

/**
 * @typedef {Object} LineageEntry
 * @property {number} index          - Zero-based entry index
 * @property {string} hash           - Chain hash for this entry
 * @property {string} prevHash       - Previous entry's hash (or GENESIS_HASH)
 * @property {string} entryId        - deriveId of the payload (content fingerprint)
 * @property {object} payload        - The stamped data (queryId, requestHash, responseHash, model)
 * @property {string} recordedAt     - ISO-8601 timestamp (metadata only, excluded from hash)
 * @property {string} harvesterId    - Originating harvester
 */

// ─── LineageContract ─────────────────────────────────────────────────────────

export class LineageContract {
  #harvesterId;
  #tenantId;
  /** @type {LineageEntry[]} */
  #chain = [];
  #headHash = GENESIS_HASH;

  /**
   * @param {object} opts
   * @param {string}       opts.harvesterId
   * @param {string|null}  [opts.tenantId]
   * @param {LineageEntry[]} [opts.seedChain]  - Restore from a persisted snapshot
   */
  constructor(opts) {
    if (!opts?.harvesterId) throw new Error('LineageContract: harvesterId is required');
    this.#harvesterId = opts.harvesterId;
    this.#tenantId = opts.tenantId ?? null;

    if (opts.seedChain?.length) {
      this.#restoreChain(opts.seedChain);
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Append a new entry to the lineage chain.
   * Returns the chain hash of the new head entry.
   *
   * @param   {StampInput} input
   * @returns {Promise<string>}  New head hash
   */
  async stamp(input) {
    this.#validateStampInput(input);

    const index = this.#chain.length;
    const prevHash = this.#headHash;

    // Canonical payload — key order is fixed so serialisation is deterministic
    const payload = {
      harvesterId: this.#harvesterId,
      index,
      model: input.model,
      queryId: input.queryId,
      requestHash: input.requestHash,
      responseHash: input.responseHash,
      tenantId: this.#tenantId,
    };

    const entryId = deriveId(payload);
    const hash = this.#chainHash(prevHash, payload);

    const entry = {
      index,
      hash,
      prevHash,
      entryId,
      payload,
      recordedAt: new Date().toISOString(),
      harvesterId: this.#harvesterId,
    };

    // Freeze to enforce immutability
    Object.freeze(entry);
    Object.freeze(entry.payload);
    this.#chain.push(entry);
    this.#headHash = hash;

    return hash;
  }

  /**
   * Verify the entire chain from genesis.
   * Returns true if the chain is intact; false if any link is broken.
   */
  async verify() {
    if (this.#chain.length === 0) return true;

    let expectedPrev = GENESIS_HASH;

    for (const entry of this.#chain) {
      if (entry.prevHash !== expectedPrev) {
        return false;
      }
      const recomputed = this.#chainHash(entry.prevHash, entry.payload);
      if (recomputed !== entry.hash) {
        return false;
      }
      expectedPrev = entry.hash;
    }

    return true;
  }

  /**
   * Return an immutable snapshot of the current chain.
   * Safe to serialise and persist; use the seedChain constructor option to restore.
   */
  async snapshot() {
    return {
      contractVersion: LINEAGE_CONTRACT_VERSION,
      genesisHash: GENESIS_HASH,
      harvesterId: this.#harvesterId,
      tenantId: this.#tenantId,
      headHash: this.#headHash,
      length: this.#chain.length,
      entries: this.#chain.map((e) => ({ ...e, payload: { ...e.payload } })),
    };
  }

  /** Return the current head (tip) hash of the chain. */
  get headHash() {
    return this.#headHash;
  }

  /** Return the number of stamped entries. */
  get length() {
    return this.#chain.length;
  }

  /**
   * Return a specific entry by index (read-only copy).
   * @param {number} index
   */
  getEntry(index) {
    const e = this.#chain[index];
    if (!e) return null;
    return { ...e, payload: { ...e.payload } };
  }

  // ── Private ────────────────────────────────────────────────────────────────

  /**
   * Compute the chain hash for an entry:
   *   SHA-256( prevHash || canonicalJson(payload) )
   */
  #chainHash(prevHash, payload) {
    return createHash('sha256')
      .update(prevHash, 'hex')
      .update(canonicalJson(payload), 'utf8')
      .digest('hex');
  }

  #validateStampInput(input) {
    const required = ['queryId', 'requestHash', 'responseHash', 'model'];
    for (const k of required) {
      if (!input?.[k] || typeof input[k] !== 'string') {
        throw new Error(`LineageContract.stamp: '${k}' must be a non-empty string`);
      }
    }
    if (!/^[0-9a-f]{64}$/.test(input.requestHash)) {
      throw new Error('LineageContract.stamp: requestHash must be a 64-char hex SHA-256');
    }
    if (!/^[0-9a-f]{64}$/.test(input.responseHash)) {
      throw new Error('LineageContract.stamp: responseHash must be a 64-char hex SHA-256');
    }
  }

  #restoreChain(entries) {
    let expectedPrev = GENESIS_HASH;
    for (const entry of entries) {
      if (entry.prevHash !== expectedPrev) {
        throw new Error(
          `LineageContract: chain integrity violation at index ${entry.index}: prevHash mismatch`
        );
      }
      const recomputed = this.#chainHash(entry.prevHash, entry.payload);
      if (recomputed !== entry.hash) {
        throw new Error(
          `LineageContract: chain integrity violation at index ${entry.index}: hash mismatch`
        );
      }
      Object.freeze(entry);
      Object.freeze(entry.payload);
      this.#chain.push(entry);
      expectedPrev = entry.hash;
    }
    this.#headHash = expectedPrev;
  }
}

export default LineageContract;
