import Database from 'better-sqlite3';

export const TIER_INDEX_SCHEMA = `
CREATE TABLE IF NOT EXISTS viking_tier_metadata (
  snapshot_id TEXT NOT NULL,
  uri TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('L0', 'L1', 'L2')),
  source_hash TEXT NOT NULL,
  tier_hash TEXT NOT NULL,
  artifact TEXT NOT NULL,
  stale INTEGER NOT NULL DEFAULT 0 CHECK (stale IN (0, 1)),
  PRIMARY KEY (snapshot_id, uri, tier)
);
`;

function assertText(value, name) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
}

function assertTier(tier) {
  if (!['L0', 'L1', 'L2'].includes(tier)) throw new TypeError('tier must be L0, L1, or L2');
}

function mapRow(row) {
  return row ? {
    snapshot_id: row.snapshot_id,
    uri: row.uri,
    tier: row.tier,
    source_hash: row.source_hash,
    tier_hash: row.tier_hash,
    artifact: row.artifact,
    stale: row.stale === 1,
  } : null;
}

export function createTierIndex({ database, filename, readonly = true } = {}) {
  if (database && filename) throw new TypeError('provide database or filename, not both');
  const db = database ?? (filename ? new Database(filename, { readonly }) : null);
  if (!db) throw new TypeError('database or filename is required');

  const getStatement = db.prepare(`
    SELECT snapshot_id, uri, tier, source_hash, tier_hash, artifact, stale
    FROM viking_tier_metadata
    WHERE snapshot_id = ? AND uri = ? AND tier = ?
  `);
  const close = () => { if (!database) db.close(); };

  return Object.freeze({
    get(snapshotId, uri, tier) {
      assertText(snapshotId, 'snapshotId');
      assertText(uri, 'uri');
      assertTier(tier);
      return mapRow(getStatement.get(snapshotId, uri, tier));
    },
    close,
  });
}

export function createTierIndexDatabase(filename) {
  const db = new Database(filename);
  db.exec(TIER_INDEX_SCHEMA);
  return db;
}
