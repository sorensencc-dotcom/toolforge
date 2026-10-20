import { DatabaseSync } from 'node:sqlite';
import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { parseMemoryKind, parseNewEntry, parseTag } from './entry.js';

const KEY_BYTES = 32;
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const KEY_CHECK_NAME = 'key_check';
const DAY_MS = 24 * 60 * 60 * 1000;

const MIGRATIONS = [
  `CREATE TABLE entries (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    sealed BLOB NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE meta (
    name TEXT PRIMARY KEY,
    value BLOB NOT NULL
  );`,
];

export class MemoryKeyError extends Error {
  name = 'MemoryKeyError';
}

export function memoryDbPath(workspaceRoot) {
  return join(workspaceRoot, '.toolforge', 'memory.db');
}

export function resolveMemoryKey({ env = process.env, keyFile = join(homedir(), '.toolforge', 'memory.key') } = {}) {
  const hex = env.TOOLFORGE_MEMORY_KEY;
  if (hex) {
    if (!/^[0-9a-f]{64}$/i.test(hex)) {
      throw new MemoryKeyError('TOOLFORGE_MEMORY_KEY must be 64 hex characters (32 bytes).');
    }
    return Buffer.from(hex, 'hex');
  }
  return readOrCreateKeyFile(keyFile);
}

function readOrCreateKeyFile(keyFile) {
  mkdirSync(dirname(keyFile), { recursive: true, mode: 0o700 });
  try {
    // 'wx' never overwrites an existing key, so concurrent first runs converge on one key file.
    writeFileSync(keyFile, randomBytes(KEY_BYTES), { flag: 'wx', mode: 0o600 });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
  const key = readFileSync(keyFile);
  if (key.length !== KEY_BYTES) {
    throw new MemoryKeyError(`Memory key file ${keyFile} must hold exactly ${KEY_BYTES} bytes, found ${key.length}.`);
  }
  return key;
}

function seal(key, plaintext, label) {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv, { authTagLength: AUTH_TAG_BYTES });
  cipher.setAAD(Buffer.from(label));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
}

function unseal(key, sealed, label) {
  const decipher = createDecipheriv('aes-256-gcm', key, sealed.subarray(0, IV_BYTES), { authTagLength: AUTH_TAG_BYTES });
  decipher.setAAD(Buffer.from(label));
  decipher.setAuthTag(sealed.subarray(IV_BYTES, IV_BYTES + AUTH_TAG_BYTES));
  return Buffer.concat([decipher.update(sealed.subarray(IV_BYTES + AUTH_TAG_BYTES)), decipher.final()]);
}

function inImmediateTransaction(db, work) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = work();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function migrate(db) {
  const { user_version: version } = db.prepare('PRAGMA user_version').get();
  if (version > MIGRATIONS.length) {
    throw new Error(`Memory store schema version ${version} is newer than this Toolforge supports (${MIGRATIONS.length}).`);
  }
  for (const migration of MIGRATIONS.slice(version)) db.exec(migration);
  if (version < MIGRATIONS.length) db.exec(`PRAGMA user_version = ${MIGRATIONS.length}`);
}

// A value sealed when the store is created lets a wrong key fail here, before it writes rows no other key can read.
function verifyKey(db, key, dbPath) {
  const row = db.prepare('SELECT value FROM meta WHERE name = ?').get(KEY_CHECK_NAME);
  if (row === undefined) {
    db.prepare('INSERT INTO meta (name, value) VALUES (?, ?)').run(KEY_CHECK_NAME, seal(key, randomBytes(KEY_BYTES), KEY_CHECK_NAME));
    return;
  }
  try {
    unseal(key, row.value, KEY_CHECK_NAME);
  } catch {
    throw new MemoryKeyError(`The memory key does not match the key that created ${dbPath}.`);
  }
}

function whereClause({ id, kind, updatedBefore }) {
  const conditions = [];
  const params = [];
  if (id !== undefined) {
    conditions.push('id = ?');
    params.push(id);
  }
  if (kind !== undefined) {
    conditions.push('kind = ?');
    params.push(kind);
  }
  if (updatedBefore !== undefined) {
    conditions.push('updated_at < ?');
    params.push(updatedBefore);
  }
  return { sql: conditions.length === 0 ? '' : ` WHERE ${conditions.join(' AND ')}`, params };
}

export function openMemoryStore({ dbPath = memoryDbPath(process.cwd()), key = resolveMemoryKey(), now = () => new Date() } = {}) {
  if (!(key instanceof Uint8Array) || key.length !== KEY_BYTES) {
    throw new MemoryKeyError(`The memory key must be ${KEY_BYTES} bytes.`);
  }
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath, { timeout: 5000 });
  try {
    // IMMEDIATE takes the write lock before user_version is read, so two processes opening a new file cannot both migrate it.
    inImmediateTransaction(db, () => {
      migrate(db);
      verifyKey(db, key, dbPath);
    });
  } catch (error) {
    db.close();
    throw error;
  }

  const insertEntry = db.prepare('INSERT INTO entries (id, kind, sealed, created_at, updated_at) VALUES (?, ?, ?, ?, ?)');
  const selectEntry = db.prepare('SELECT * FROM entries WHERE id = ?');
  const deleteEntry = db.prepare('DELETE FROM entries WHERE id = ?');

  // The row id is the AAD, so a payload copied onto another row fails authentication instead of decrypting as that row.
  function openPayload(row) {
    try {
      return unseal(key, row.sealed, row.id);
    } catch {
      throw new Error(`Memory entry ${row.id} failed authentication. ${dbPath} is corrupt or was modified outside Toolforge.`);
    }
  }

  function toEntry(row) {
    const { text, tags, source } = JSON.parse(openPayload(row).toString('utf8'));
    return { id: row.id, kind: row.kind, text, tags, source, createdAt: row.created_at, updatedAt: row.updated_at };
  }

  function selectEntries(where) {
    return db.prepare(`SELECT * FROM entries${where.sql} ORDER BY created_at, rowid`).all(...where.params).map(toEntry);
  }

  return {
    add(input) {
      const { kind, text, tags, source } = parseNewEntry(input);
      const id = randomUUID();
      const timestamp = now().toISOString();
      insertEntry.run(id, kind, seal(key, Buffer.from(JSON.stringify({ text, tags, source })), id), timestamp, timestamp);
      return { id, kind, text, tags, source, createdAt: timestamp, updatedAt: timestamp };
    },

    list({ kind, tag } = {}) {
      const entries = selectEntries(whereClause({ kind: kind === undefined ? undefined : parseMemoryKind(kind) }));
      if (tag === undefined) return entries;
      const wanted = parseTag(tag);
      return entries.filter((entry) => entry.tags.includes(wanted));
    },

    get(id) {
      const row = selectEntry.get(id);
      return row === undefined ? undefined : toEntry(row);
    },

    remove(id) {
      return deleteEntry.run(id).changes > 0;
    },

    prune({ id, olderThanDays, kind, all = false, dryRun = false } = {}) {
      const filtered = id !== undefined || olderThanDays !== undefined || kind !== undefined;
      if (!filtered && !all) {
        throw new Error('Prune needs a selector: an id, an older-than age in days, a kind, or all.');
      }
      if (filtered && all) {
        throw new Error('Prune with all removes every entry, so it cannot be combined with id, older-than, or kind.');
      }
      if (olderThanDays !== undefined && !(Number.isFinite(olderThanDays) && olderThanDays >= 0)) {
        throw new RangeError('The older-than age must be a non-negative number of days.');
      }
      const where = whereClause({
        id,
        kind: kind === undefined ? undefined : parseMemoryKind(kind),
        updatedBefore: olderThanDays === undefined ? undefined : new Date(now().getTime() - olderThanDays * DAY_MS).toISOString(),
      });
      return inImmediateTransaction(db, () => {
        const removed = selectEntries(where);
        if (!dryRun) db.prepare(`DELETE FROM entries${where.sql}`).run(...where.params);
        return removed;
      });
    },

    close() {
      if (db.isOpen) db.close();
    },
  };
}
