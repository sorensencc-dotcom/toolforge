import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export const DEFAULT_MERIDIAN_DB = path.join(os.homedir(), '.meridian', 'meridian.db');

// Meridian polls every 60s; a live session unseen for longer than this is stale.
const FRESH_WINDOW_MS = 10 * 60_000;

// meridian.db holds raw screen text (capture_frames, window_titles, session_text).
// These queries select only non-text aggregate columns; keep it that way.
const ACTIVE_SQL = 'SELECT app_name, category, started_at, last_seen_at FROM active_session LIMIT 1';
const TODAY_SQL = `SELECT category, COUNT(*) AS sessions, COALESCE(SUM(duration_s), 0) AS seconds
  FROM app_sessions WHERE started_at >= ? GROUP BY category`;

/**
 * Collect operator focus telemetry from Meridian's local database (read-only).
 * @param {string} dbPath - Path to meridian.db.
 * @param {Date} now - Reference time.
 * @returns {object} Meridian summary, or { available: false, reason }.
 */
export function collectMeridianTelemetry(dbPath = DEFAULT_MERIDIAN_DB, now = new Date()) {
  if (!fs.existsSync(dbPath)) return { available: false, reason: 'db-missing' };

  let db;
  try {
    const { DatabaseSync } = process.getBuiltinModule('node:sqlite');
    db = new DatabaseSync(dbPath, { readOnly: true });

    const row = db.prepare(ACTIVE_SQL).get();
    const lastSeenMs = row ? Date.parse(row.last_seen_at) : NaN;
    const daemonFresh = Number.isFinite(lastSeenMs) && now.getTime() - lastSeenMs <= FRESH_WINDOW_MS;
    const active = daemonFresh ? {
      app_name: row.app_name,
      category: row.category,
      started_at: row.started_at,
      last_seen_at: row.last_seen_at,
      elapsed_minutes: Math.floor((lastSeenMs - Date.parse(row.started_at)) / 60_000)
    } : null;

    const localMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const minutesByCategory = {};
    let sessionCount = 0;
    let totalSeconds = 0;
    for (const r of db.prepare(TODAY_SQL).all(localMidnight)) {
      minutesByCategory[r.category || 'uncategorized'] = Math.round(r.seconds / 60);
      sessionCount += r.sessions;
      totalSeconds += r.seconds;
    }

    return {
      available: true,
      daemon_fresh: daemonFresh,
      active,
      today: {
        session_count: sessionCount,
        total_minutes: Math.round(totalSeconds / 60),
        minutes_by_category: minutesByCategory
      }
    };
  } catch {
    return { available: false, reason: 'db-error' };
  } finally {
    db?.close();
  }
}
