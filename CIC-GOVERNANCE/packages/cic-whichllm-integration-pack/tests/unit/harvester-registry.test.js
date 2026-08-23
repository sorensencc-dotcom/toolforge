/**
 * Unit Tests — HarvesterRegistry
 * CIC-WHICHLLM-INTEGRATION-PACK v1.0
 *
 * Runner: Node 20+ built-in test runner  (node --test)
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  HARVESTER_REGISTRY,
  registerHarvester,
  updateHarvester,
  retireHarvester,
  pauseHarvester,
  activateHarvester,
  getHarvester,
  listHarvesters,
  registryHealthSummary,
  RegistryError,
} from '../../src/harvester/harvester-registry.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _idCounter = 0;
function uniqueId() {
  return `test-harvester-${Date.now()}-${++_idCounter}`;
}

function makeRecord(overrides = {}) {
  return {
    harvesterId: uniqueId(),
    displayName: 'Test Harvester',
    apiEndpoint: 'https://api.test.whichllm.io',
    status: 'active',
    amendmentRefs: ['§2/S3-A1'],
    capabilities: ['query'],
    meta: {},
    ...overrides,
  };
}

// ─── registerHarvester ────────────────────────────────────────────────────────

describe('registerHarvester()', () => {
  it('adds a new entry to the registry', () => {
    const rec = makeRecord();
    const result = registerHarvester(rec);
    assert.equal(result.harvesterId, rec.harvesterId);
    assert.ok(HARVESTER_REGISTRY.has(rec.harvesterId));
  });

  it('sets adapterType to "whichllm" regardless of input', () => {
    const rec = makeRecord();
    const result = registerHarvester(rec);
    assert.equal(result.adapterType, 'whichllm');
  });

  it('sets registeredAt and updatedAt', () => {
    const rec = makeRecord();
    const result = registerHarvester(rec);
    assert.ok(result.registeredAt);
    assert.ok(result.updatedAt);
  });

  it('throws RegistryError when harvesterId is already registered', () => {
    const rec = makeRecord();
    registerHarvester(rec);
    assert.throws(() => registerHarvester(rec), (err) => err instanceof RegistryError && /already registered/.test(err.message));
  });

  it('throws RegistryError for invalid harvesterId characters', () => {
    const rec = makeRecord({ harvesterId: 'bad id with spaces!' });
    assert.throws(() => registerHarvester(rec), RegistryError);
  });

  it('throws RegistryError for non-absolute apiEndpoint', () => {
    const rec = makeRecord({ apiEndpoint: 'not-a-url' });
    assert.throws(() => registerHarvester(rec), RegistryError);
  });

  it('throws RegistryError for invalid status', () => {
    const rec = makeRecord({ status: 'unknown' });
    assert.throws(() => registerHarvester(rec), RegistryError);
  });

  it('throws RegistryError when displayName is missing', () => {
    const { displayName: _, ...rec } = makeRecord();
    assert.throws(() => registerHarvester(rec), RegistryError);
  });
});

// ─── updateHarvester ──────────────────────────────────────────────────────────

describe('updateHarvester()', () => {
  it('updates mutable fields', () => {
    const rec = makeRecord();
    registerHarvester(rec);
    const updated = updateHarvester(rec.harvesterId, { displayName: 'Renamed Harvester' });
    assert.equal(updated.displayName, 'Renamed Harvester');
  });

  it('preserves harvesterId (immutable)', () => {
    const rec = makeRecord();
    registerHarvester(rec);
    const updated = updateHarvester(rec.harvesterId, { harvesterId: 'different-id' });
    assert.equal(updated.harvesterId, rec.harvesterId);
  });

  it('preserves registeredAt (immutable)', () => {
    const rec = makeRecord();
    const original = registerHarvester(rec);
    const updated = updateHarvester(rec.harvesterId, { registeredAt: '2000-01-01T00:00:00Z' });
    assert.equal(updated.registeredAt, original.registeredAt);
  });

  it('bumps updatedAt', async () => {
    const rec = makeRecord();
    const original = registerHarvester(rec);
    await new Promise((r) => setTimeout(r, 5));
    const updated = updateHarvester(rec.harvesterId, { displayName: 'New Name' });
    assert.notEqual(updated.updatedAt, original.updatedAt);
  });

  it('throws RegistryError for unknown harvesterId', () => {
    assert.throws(
      () => updateHarvester('does-not-exist-xyz', { displayName: 'X' }),
      RegistryError
    );
  });
});

// ─── Status transitions ───────────────────────────────────────────────────────

describe('retireHarvester() / pauseHarvester() / activateHarvester()', () => {
  it('retireHarvester sets status to "retired"', () => {
    const rec = makeRecord();
    registerHarvester(rec);
    const result = retireHarvester(rec.harvesterId);
    assert.equal(result.status, 'retired');
  });

  it('pauseHarvester sets status to "paused"', () => {
    const rec = makeRecord();
    registerHarvester(rec);
    const result = pauseHarvester(rec.harvesterId);
    assert.equal(result.status, 'paused');
  });

  it('activateHarvester sets status to "active"', () => {
    const rec = makeRecord({ status: 'paused' });
    registerHarvester(rec);
    const result = activateHarvester(rec.harvesterId);
    assert.equal(result.status, 'active');
  });

  it('retired harvester remains in registry (R-REG-04)', () => {
    const rec = makeRecord();
    registerHarvester(rec);
    retireHarvester(rec.harvesterId);
    assert.ok(HARVESTER_REGISTRY.has(rec.harvesterId));
  });
});

// ─── getHarvester ─────────────────────────────────────────────────────────────

describe('getHarvester()', () => {
  it('returns the entry for a known harvesterId', () => {
    const rec = makeRecord();
    registerHarvester(rec);
    const found = getHarvester(rec.harvesterId);
    assert.equal(found.harvesterId, rec.harvesterId);
  });

  it('returns undefined for an unknown harvesterId', () => {
    assert.equal(getHarvester('nonexistent-abc'), undefined);
  });
});

// ─── listHarvesters ───────────────────────────────────────────────────────────

describe('listHarvesters()', () => {
  it('returns all harvesters when no filter', () => {
    const all = listHarvesters();
    assert.ok(all.length >= 1); // at least the seeded default
  });

  it('filters by status', () => {
    const rec = makeRecord({ status: 'paused' });
    registerHarvester(rec);
    const paused = listHarvesters({ status: 'paused' });
    assert.ok(paused.some((e) => e.harvesterId === rec.harvesterId));
    const active = listHarvesters({ status: 'active' });
    assert.ok(!active.some((e) => e.harvesterId === rec.harvesterId));
  });

  it('filters by amendmentRef', () => {
    const rec = makeRecord({ amendmentRefs: ['§2/S3-A1'] });
    registerHarvester(rec);
    const matched = listHarvesters({ amendmentRef: '§2/S3-A1' });
    assert.ok(matched.some((e) => e.harvesterId === rec.harvesterId));
  });
});

// ─── registryHealthSummary ────────────────────────────────────────────────────

describe('registryHealthSummary()', () => {
  it('returns expected shape', () => {
    const summary = registryHealthSummary();
    assert.ok(typeof summary.total === 'number');
    assert.ok(typeof summary.active === 'number');
    assert.ok(typeof summary.paused === 'number');
    assert.ok(typeof summary.retired === 'number');
    assert.ok(typeof summary.compliant === 'number');
    assert.ok(typeof summary.nonCompliant === 'number');
    assert.ok(summary.generatedAt);
  });

  it('total >= active + paused + retired', () => {
    const s = registryHealthSummary();
    // total is all entries, active+paused+retired should sum to total
    assert.equal(s.total, s.active + s.paused + s.retired);
  });
});