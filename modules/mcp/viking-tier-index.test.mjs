import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { createTierIndex, createTierIndexDatabase, TIER_INDEX_SCHEMA } from './viking-tier-index.mjs';

function dbFixture() {
  const filename = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'viking-tier-')), 'tiers.db');
  const db = createTierIndexDatabase(filename);
  db.prepare(`INSERT INTO viking_tier_metadata
    (snapshot_id, uri, tier, source_hash, tier_hash, artifact, stale)
    VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run('20260828-000000', 'viking://kb-sync/wiki/concepts/one.md', 'L1', 'src-hash', 'tier-hash', 'wiki/concepts/one.md', 1);
  return { filename, db };
}

test('declares explicit tier metadata schema', () => {
  assert.match(TIER_INDEX_SCHEMA, /snapshot_id TEXT NOT NULL/);
  assert.match(TIER_INDEX_SCHEMA, /CHECK \(tier IN \('L0', 'L1', 'L2'\)\)/);
  assert.match(TIER_INDEX_SCHEMA, /stale INTEGER NOT NULL DEFAULT 0/);
});

test('performs read-only lookup and maps stale flag', () => {
  const fixture = dbFixture();
  fixture.db.close();
  const index = createTierIndex({ filename: fixture.filename });
  assert.deepEqual(index.get('20260828-000000', 'viking://kb-sync/wiki/concepts/one.md', 'L1'), {
    snapshot_id: '20260828-000000',
    uri: 'viking://kb-sync/wiki/concepts/one.md',
    tier: 'L1',
    source_hash: 'src-hash',
    tier_hash: 'tier-hash',
    artifact: 'wiki/concepts/one.md',
    category: null,
    tier_available: true,
    compiled_at: null,
    source_path: null,
    freshness: 'stale',
    stale: true,
  });
  assert.equal(index.get('20260828-000000', 'viking://kb-sync/wiki/concepts/one.md', 'L0'), null);
  index.close();
});

test('opens existing database read-only and rejects writes', () => {
  const fixture = dbFixture();
  fixture.db.close();
  const index = createTierIndex({ filename: fixture.filename });
  assert.throws(() => new Database(fixture.filename, { readonly: true }).exec('DROP TABLE viking_tier_metadata'), /readonly|read-only/i);
  assert.throws(() => index.get('', 'uri', 'L1'), /snapshotId must be a non-empty string/);
  index.close();
});
