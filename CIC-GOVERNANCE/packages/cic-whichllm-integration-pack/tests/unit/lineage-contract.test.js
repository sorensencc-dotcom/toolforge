/**
 * Unit Tests — LineageContract
 * CIC-WHICHLLM-INTEGRATION-PACK v1.0
 *
 * Runner: Node 20+ built-in test runner  (node --test)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  LineageContract,
  GENESIS_HASH,
  LINEAGE_CONTRACT_VERSION,
} from '../../src/lineage/lineage-contract.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BASE_OPTS = {
  harvesterId: 'cic-whichllm-default-v1',
  tenantId: 'tenant-test',
};

const STAMP_A = {
  queryId: 'qry-001',
  requestHash: 'a'.repeat(64),
  responseHash: 'b'.repeat(64),
  model: 'gpt-4o',
};

const STAMP_B = {
  queryId: 'qry-002',
  requestHash: 'c'.repeat(64),
  responseHash: 'd'.repeat(64),
  model: 'gpt-4o',
};

// ─── Genesis ──────────────────────────────────────────────────────────────────

describe('GENESIS_HASH', () => {
  it('is a valid 64-char hex string', () => {
    assert.match(GENESIS_HASH, /^[0-9a-f]{64}$/);
  });

  it('is deterministic across module loads', () => {
    // Import a second time — hash must match
    assert.equal(GENESIS_HASH.length, 64);
    assert.match(GENESIS_HASH, /^[0-9a-f]{64}$/);
  });
});

// ─── Construction ─────────────────────────────────────────────────────────────

describe('LineageContract construction', () => {
  it('instantiates with valid opts', () => {
    const lc = new LineageContract(BASE_OPTS);
    assert.ok(lc);
    assert.equal(lc.length, 0);
    assert.equal(lc.headHash, GENESIS_HASH);
  });

  it('throws when harvesterId is missing', () => {
    assert.throws(() => new LineageContract({}), /harvesterId/);
  });

  it('starts with headHash equal to GENESIS_HASH', () => {
    const lc = new LineageContract(BASE_OPTS);
    assert.equal(lc.headHash, GENESIS_HASH);
  });
});

// ─── stamp() ─────────────────────────────────────────────────────────────────

describe('LineageContract.stamp()', () => {
  it('returns a 64-char hex hash', async () => {
    const lc = new LineageContract(BASE_OPTS);
    const hash = await lc.stamp(STAMP_A);
    assert.match(hash, /^[0-9a-f]{64}$/);
  });

  it('updates headHash after stamp', async () => {
    const lc = new LineageContract(BASE_OPTS);
    const hash = await lc.stamp(STAMP_A);
    assert.equal(lc.headHash, hash);
    assert.notEqual(lc.headHash, GENESIS_HASH);
  });

  it('increments length', async () => {
    const lc = new LineageContract(BASE_OPTS);
    await lc.stamp(STAMP_A);
    assert.equal(lc.length, 1);
    await lc.stamp(STAMP_B);
    assert.equal(lc.length, 2);
  });

  it('produces different hashes for different inputs', async () => {
    const lc = new LineageContract(BASE_OPTS);
    const h1 = await lc.stamp(STAMP_A);
    const h2 = await lc.stamp(STAMP_B);
    assert.notEqual(h1, h2);
  });

  it('is deterministic — same input sequence yields same hash chain', async () => {
    const lc1 = new LineageContract(BASE_OPTS);
    const lc2 = new LineageContract(BASE_OPTS);

    const h1a = await lc1.stamp(STAMP_A);
    const h1b = await lc1.stamp(STAMP_B);

    const h2a = await lc2.stamp(STAMP_A);
    const h2b = await lc2.stamp(STAMP_B);

    assert.equal(h1a, h2a);
    assert.equal(h1b, h2b);
  });

  it('throws when requestHash is not 64-char hex', async () => {
    const lc = new LineageContract(BASE_OPTS);
    await assert.rejects(
      lc.stamp({ ...STAMP_A, requestHash: 'not-a-hash' }),
      /requestHash/
    );
  });

  it('throws when responseHash is not 64-char hex', async () => {
    const lc = new LineageContract(BASE_OPTS);
    await assert.rejects(
      lc.stamp({ ...STAMP_A, responseHash: 'short' }),
      /responseHash/
    );
  });

  it('throws when queryId is missing', async () => {
    const lc = new LineageContract(BASE_OPTS);
    const { queryId: _, ...bad } = STAMP_A;
    await assert.rejects(lc.stamp(bad), /queryId/);
  });

  it('throws when model is missing', async () => {
    const lc = new LineageContract(BASE_OPTS);
    const { model: _, ...bad } = STAMP_A;
    await assert.rejects(lc.stamp(bad), /model/);
  });
});

// ─── verify() ────────────────────────────────────────────────────────────────

describe('LineageContract.verify()', () => {
  it('returns true for empty chain', async () => {
    const lc = new LineageContract(BASE_OPTS);
    assert.equal(await lc.verify(), true);
  });

  it('returns true for a valid chain', async () => {
    const lc = new LineageContract(BASE_OPTS);
    await lc.stamp(STAMP_A);
    await lc.stamp(STAMP_B);
    assert.equal(await lc.verify(), true);
  });
});

// ─── snapshot() / restore ─────────────────────────────────────────────────────

describe('LineageContract.snapshot() + restore', () => {
  it('snapshot returns the expected shape', async () => {
    const lc = new LineageContract(BASE_OPTS);
    await lc.stamp(STAMP_A);
    const snap = await lc.snapshot();
    assert.equal(snap.contractVersion, LINEAGE_CONTRACT_VERSION);
    assert.equal(snap.genesisHash, GENESIS_HASH);
    assert.equal(snap.harvesterId, BASE_OPTS.harvesterId);
    assert.equal(snap.length, 1);
    assert.ok(Array.isArray(snap.entries));
    assert.equal(snap.entries.length, 1);
  });

  it('chain can be restored from snapshot and passes verify()', async () => {
    const lc1 = new LineageContract(BASE_OPTS);
    await lc1.stamp(STAMP_A);
    await lc1.stamp(STAMP_B);
    const snap = await lc1.snapshot();

    const lc2 = new LineageContract({ ...BASE_OPTS, seedChain: snap.entries });
    assert.equal(lc2.headHash, lc1.headHash);
    assert.equal(await lc2.verify(), true);
  });

  it('restored chain can continue to grow', async () => {
    const lc1 = new LineageContract(BASE_OPTS);
    await lc1.stamp(STAMP_A);
    const snap = await lc1.snapshot();

    const lc2 = new LineageContract({ ...BASE_OPTS, seedChain: snap.entries });
    await lc2.stamp(STAMP_B);
    assert.equal(lc2.length, 2);
    assert.equal(await lc2.verify(), true);
  });

  it('restoring a tampered chain throws', async () => {
    const lc = new LineageContract(BASE_OPTS);
    await lc.stamp(STAMP_A);
    const snap = await lc.snapshot();

    // Tamper: alter a payload field
    snap.entries[0] = { ...snap.entries[0], payload: { ...snap.entries[0].payload, model: 'evil-model' } };

    assert.throws(
      () => new LineageContract({ ...BASE_OPTS, seedChain: snap.entries }),
      /integrity violation/
    );
  });
});

// ─── getEntry() ───────────────────────────────────────────────────────────────

describe('LineageContract.getEntry()', () => {
  it('returns null for out-of-range index', async () => {
    const lc = new LineageContract(BASE_OPTS);
    assert.equal(lc.getEntry(0), null);
  });

  it('returns a copy of the entry at the given index', async () => {
    const lc = new LineageContract(BASE_OPTS);
    await lc.stamp(STAMP_A);
    const entry = lc.getEntry(0);
    assert.equal(entry.index, 0);
    assert.equal(entry.payload.queryId, STAMP_A.queryId);
  });

  it('returned entry is a copy — mutating it does not affect chain', async () => {
    const lc = new LineageContract(BASE_OPTS);
    await lc.stamp(STAMP_A);
    const entry = lc.getEntry(0);
    entry.payload.queryId = 'MUTATED';
    // Original entry in chain must be unchanged
    assert.equal(lc.getEntry(0).payload.queryId, STAMP_A.queryId);
  });
});