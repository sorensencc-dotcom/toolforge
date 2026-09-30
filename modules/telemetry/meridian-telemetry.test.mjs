import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { collectMeridianTelemetry } from './meridian-telemetry.mjs';
import { collectIcfTelemetry, formatPrometheusMetrics } from './icf-ingestion-hook.mjs';

const { DatabaseSync } = process.getBuiltinModule('node:sqlite');

const SENTINEL = 'SENTINEL-SCREEN-TEXT-4242';
// Local noon, so "today" windows never straddle midnight.
const NOW = new Date(2026, 8, 30, 12, 0, 0);
const minsAgo = (m) => new Date(NOW.getTime() - m * 60_000).toISOString();

function buildFixture(dbPath, { activeLastSeenMinsAgo = 2 } = {}) {
  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE app_sessions (id INTEGER PRIMARY KEY, app_name TEXT, started_at TEXT, ended_at TEXT,
      duration_s INTEGER, category TEXT, window_titles TEXT, session_text TEXT, session_summary TEXT);
    CREATE TABLE active_session (id INTEGER PRIMARY KEY, app_name TEXT, started_at TEXT, last_seen_at TEXT,
      category TEXT, window_titles TEXT, session_text TEXT);
    CREATE TABLE capture_frames (id INTEGER PRIMARY KEY, window_name TEXT, full_text TEXT);
  `);
  const ins = db.prepare(`INSERT INTO app_sessions (app_name, started_at, ended_at, duration_s, category, window_titles, session_text, session_summary)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  ins.run('Code.exe', minsAgo(90), minsAgo(60), 1800, 'coding', SENTINEL, SENTINEL, SENTINEL);
  ins.run('chrome.exe', minsAgo(50), minsAgo(40), 600, 'research', SENTINEL, SENTINEL, SENTINEL);
  ins.run('Code.exe', minsAgo(26 * 60), minsAgo(25 * 60), 3600, 'coding', SENTINEL, SENTINEL, SENTINEL);
  db.prepare(`INSERT INTO active_session (id, app_name, started_at, last_seen_at, category, window_titles, session_text)
    VALUES (1, 'Code.exe', ?, ?, 'coding', ?, ?)`).run(minsAgo(15), minsAgo(activeLastSeenMinsAgo), SENTINEL, SENTINEL);
  db.prepare('INSERT INTO capture_frames (window_name, full_text) VALUES (?, ?)').run(SENTINEL, SENTINEL);
  db.close();
}

describe('Meridian telemetry', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'meridian-telemetry-test-'));
  const freshDb = path.join(tempDir, 'fresh.db');
  const staleDb = path.join(tempDir, 'stale.db');

  before(() => {
    buildFixture(freshDb);
    buildFixture(staleDb, { activeLastSeenMinsAgo: 30 });
  });
  after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

  test('reports unavailable when the database is missing', () => {
    const result = collectMeridianTelemetry(path.join(tempDir, 'nope.db'), NOW);
    assert.deepEqual(result, { available: false, reason: 'db-missing' });
  });

  test('summarizes the live session and today by category', () => {
    const result = collectMeridianTelemetry(freshDb, NOW);
    assert.equal(result.available, true);
    assert.equal(result.daemon_fresh, true);
    assert.deepEqual(result.active, {
      app_name: 'Code.exe',
      category: 'coding',
      started_at: minsAgo(15),
      last_seen_at: minsAgo(2),
      elapsed_minutes: 13
    });
    assert.deepEqual(result.today, {
      session_count: 2,
      total_minutes: 40,
      minutes_by_category: { coding: 30, research: 10 }
    });
  });

  test('drops the live session when the daemon has gone quiet', () => {
    const result = collectMeridianTelemetry(staleDb, NOW);
    assert.equal(result.daemon_fresh, false);
    assert.equal(result.active, null);
  });

  test('never emits captured screen text', () => {
    const result = collectMeridianTelemetry(freshDb, NOW);
    assert.ok(!JSON.stringify(result).includes(SENTINEL));
  });

  test('is wired into the ICF envelope and Prometheus output', () => {
    const telemetry = collectIcfTelemetry(process.cwd(), tempDir, { meridianDbPath: freshDb, now: NOW });
    assert.equal(telemetry.meridian.available, true);

    const prom = formatPrometheusMetrics(telemetry);
    assert.ok(prom.includes('icf_meridian_available 1'));
    assert.ok(prom.includes('icf_meridian_daemon_fresh 1'));
    assert.ok(prom.includes('icf_meridian_today_minutes{category="coding"} 30'));
    assert.ok(!prom.includes(SENTINEL));
  });
});
