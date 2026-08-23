/**
 * CIC Harvester Registry — WHICHLLM Extension
 * Spec: CIC v2.4.0 | Amendment §2/S3-A1
 * Pack: CIC-WHICHLLM-INTEGRATION-PACK v1.0
 *
 * This module exports the singleton HARVESTER_REGISTRY Map and provides
 * management utilities for WHICHLLM harvester entries.
 *
 * Registry entry shape (HarvesterRecord):
 * {
 *   harvesterId:   string          — unique stable ID
 *   displayName:   string          — human-readable name
 *   adapterType:   'whichllm'      — must be 'whichllm' for this pack
 *   apiEndpoint:   string          — WHICHLLM API base URL
 *   status:        'active'|'paused'|'retired'
 *   amendmentRefs: string[]        — CIC amendments this harvester is bound to
 *   capabilities:  string[]        — declared harvester capability flags
 *   registeredAt:  string          — ISO-8601 (metadata; excluded from chain hash)
 *   updatedAt:     string          — ISO-8601 (metadata)
 *   meta:          object          — operator-defined key/value pairs
 * }
 *
 * §2/S3-A1 Requirements:
 *   R-REG-01  Every harvesterId must be globally unique within the registry.
 *   R-REG-02  adapterType MUST be 'whichllm' for entries managed by this pack.
 *   R-REG-03  amendmentRefs MUST include '§2/S3-A1' for active WHICHLLM harvesters.
 *   R-REG-04  status changes are append-logged; registry entries are never hard-deleted.
 */

// ─── Singleton Registry ───────────────────────────────────────────────────────

/**
 * @type {Map<string, HarvesterRecord>}
 * Keyed by harvesterId.
 */
export const HARVESTER_REGISTRY = new Map();

// ─── Seed: Built-in reference harvester (overwrite for production) ────────────

HARVESTER_REGISTRY.set('cic-whichllm-default-v1', {
  harvesterId: 'cic-whichllm-default-v1',
  displayName: 'CIC WHICHLLM Default Harvester v1',
  adapterType: 'whichllm',
  apiEndpoint: 'https://api.whichllm.io',
  status: 'active',
  amendmentRefs: ['§2/S3-A1'],
  capabilities: ['query', 'batch', 'lineage', 'governance', 'observability'],
  registeredAt: '2026-08-23T00:00:00.000Z',
  updatedAt: '2026-08-23T00:00:00.000Z',
  meta: {
    pack: 'CIC-WHICHLLM-INTEGRATION-PACK',
    packVersion: '1.0.0',
    environment: 'production',
  },
});

// ─── Registry API ─────────────────────────────────────────────────────────────

/**
 * Register a new WHICHLLM harvester.
 * Throws if harvesterId already exists (use updateHarvester to modify).
 *
 * @param {HarvesterRecord} record
 * @returns {HarvesterRecord}
 */
export function registerHarvester(record) {
  validateRecord(record);
  if (HARVESTER_REGISTRY.has(record.harvesterId)) {
    throw new RegistryError(
      `harvesterId '${record.harvesterId}' is already registered. Use updateHarvester() to modify.`
    );
  }
  const now = new Date().toISOString();
  const entry = Object.freeze({
    ...record,
    adapterType: 'whichllm',
    registeredAt: record.registeredAt ?? now,
    updatedAt: now,
  });
  HARVESTER_REGISTRY.set(entry.harvesterId, entry);
  return entry;
}

/**
 * Update mutable fields of an existing harvester.
 * harvesterId and registeredAt are immutable.
 *
 * @param {string} harvesterId
 * @param {Partial<HarvesterRecord>} patch
 * @returns {HarvesterRecord}
 */
export function updateHarvester(harvesterId, patch) {
  const existing = HARVESTER_REGISTRY.get(harvesterId);
  if (!existing) {
    throw new RegistryError(`harvesterId '${harvesterId}' not found in registry`);
  }
  // Guard immutable fields
  const { harvesterId: _id, registeredAt: _reg, ...allowedPatch } = patch;

  const updated = Object.freeze({
    ...existing,
    ...allowedPatch,
    harvesterId: existing.harvesterId,          // immutable
    registeredAt: existing.registeredAt,         // immutable
    adapterType: 'whichllm',                     // immutable for this pack
    updatedAt: new Date().toISOString(),
  });
  HARVESTER_REGISTRY.set(harvesterId, updated);
  return updated;
}

/**
 * Retire a harvester (sets status to 'retired'; never hard-deletes, per R-REG-04).
 *
 * @param {string} harvesterId
 * @returns {HarvesterRecord}
 */
export function retireHarvester(harvesterId) {
  return updateHarvester(harvesterId, { status: 'retired' });
}

/**
 * Pause a harvester (status → 'paused'; governance checks will fail in strictMode).
 *
 * @param {string} harvesterId
 * @returns {HarvesterRecord}
 */
export function pauseHarvester(harvesterId) {
  return updateHarvester(harvesterId, { status: 'paused' });
}

/**
 * Re-activate a paused or retired harvester.
 *
 * @param {string} harvesterId
 * @returns {HarvesterRecord}
 */
export function activateHarvester(harvesterId) {
  return updateHarvester(harvesterId, { status: 'active' });
}

/**
 * Look up a harvester — alias for HARVESTER_REGISTRY.get() with typed return.
 *
 * @param   {string} harvesterId
 * @returns {HarvesterRecord|undefined}
 */
export function getHarvester(harvesterId) {
  return HARVESTER_REGISTRY.get(harvesterId);
}

/**
 * List all harvesters, optionally filtered by status.
 *
 * @param {object} [opts]
 * @param {string} [opts.status]       - Filter by status ('active', 'paused', 'retired')
 * @param {string} [opts.amendmentRef] - Filter by amendment binding
 * @returns {HarvesterRecord[]}
 */
export function listHarvesters(opts = {}) {
  let entries = [...HARVESTER_REGISTRY.values()];
  if (opts.status) {
    entries = entries.filter((e) => e.status === opts.status);
  }
  if (opts.amendmentRef) {
    entries = entries.filter((e) => e.amendmentRefs?.includes(opts.amendmentRef));
  }
  return entries;
}

/**
 * Return a registry health summary: total count, active count, compliance check.
 */
export function registryHealthSummary() {
  const all = [...HARVESTER_REGISTRY.values()];
  const active = all.filter((e) => e.status === 'active');
  const compliant = active.filter(
    (e) => e.amendmentRefs?.includes('§2/S3-A1') && e.adapterType === 'whichllm'
  );
  return {
    total: all.length,
    active: active.length,
    paused: all.filter((e) => e.status === 'paused').length,
    retired: all.filter((e) => e.status === 'retired').length,
    compliant: compliant.length,
    nonCompliant: active.length - compliant.length,
    generatedAt: new Date().toISOString(),
  };
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateRecord(record) {
  const required = ['harvesterId', 'displayName', 'apiEndpoint', 'status'];
  for (const k of required) {
    if (!record[k]) throw new RegistryError(`HarvesterRecord missing required field: '${k}'`);
  }
  if (!/^[a-zA-Z0-9_\-\.]+$/.test(record.harvesterId)) {
    throw new RegistryError(
      `harvesterId '${record.harvesterId}' contains invalid characters. Use [a-zA-Z0-9_\\-\\.] only.`
    );
  }
  if (!['active', 'paused', 'retired'].includes(record.status)) {
    throw new RegistryError(`status must be 'active', 'paused', or 'retired'; got '${record.status}'`);
  }
  if (!/^https?:\/\//i.test(record.apiEndpoint)) {
    throw new RegistryError(`apiEndpoint must be an absolute URL`);
  }
}

// ─── Error ────────────────────────────────────────────────────────────────────

export class RegistryError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RegistryError';
  }
}

export default HARVESTER_REGISTRY;
