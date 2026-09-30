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
const RANGE_SQL = `SELECT category, COALESCE(SUM(duration_s), 0) AS seconds
  FROM app_sessions WHERE started_at >= ? AND started_at < ? GROUP BY category`;
// day_summaries.narrative and day_tasks.summary are screen-derived prose; never select them.
const SUMMARY_SQL = `SELECT headline, insights_json, plan_json, adherence_json, standup_json, generated_at
  FROM day_summaries WHERE day_local = ? AND fallback = 0`;
const SUMMARY_DAYS_SQL = 'SELECT day_local FROM day_summaries WHERE fallback = 0 ORDER BY day_local';
const DAY_TASKS_SQL = 'SELECT task_id, title, minutes FROM day_tasks WHERE day_local = ?';
const IDLE_CATEGORY = 'idle_personal';
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

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

function openReadOnly(dbPath) {
  const { DatabaseSync } = process.getBuiltinModule('node:sqlite');
  return new DatabaseSync(dbPath, { readOnly: true });
}

function parseJson(text, fallback) {
  try {
    return JSON.parse(text) ?? fallback;
  } catch {
    return fallback;
  }
}

function localDayBounds(day) {
  const [y, m, d] = day.split('-').map(Number);
  return [new Date(y, m - 1, d).toISOString(), new Date(y, m - 1, d + 1).toISOString()];
}

function shiftDay(day, delta) {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y, m - 1, d + delta);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function readDayTime(db, day) {
  const minutesByCategory = {};
  let trackedSeconds = 0;
  let idleSeconds = 0;
  for (const r of db.prepare(RANGE_SQL).all(...localDayBounds(day))) {
    const category = r.category || 'uncategorized';
    if (category === IDLE_CATEGORY) {
      idleSeconds += r.seconds;
      continue;
    }
    minutesByCategory[category] = Math.round(r.seconds / 60);
    trackedSeconds += r.seconds;
  }
  return {
    tracked_minutes: Math.round(trackedSeconds / 60),
    idle_minutes: Math.round(idleSeconds / 60),
    minutes_by_category: minutesByCategory
  };
}

function readSummary(db, day) {
  const row = db.prepare(SUMMARY_SQL).get(day);
  if (!row) return null;

  const plan = parseJson(row.plan_json, []);
  const plannedTaskIds = new Set(plan.flatMap((p) => p.day_task_ids || []));
  const tasks = db.prepare(DAY_TASKS_SQL).all(day);

  return {
    headline: row.headline,
    generated_at: row.generated_at,
    insights: parseJson(row.insights_json, []).map(({ title, text }) => ({ title, text })),
    adherence: parseJson(row.adherence_json, {}),
    standup: parseJson(row.standup_json, []),
    plan: plan.map((p) => ({
      task_key: p.task_key,
      title: p.title,
      outcome: p.outcome,
      minutes: p.minutes,
      url: /^https:\/\//.test(p.url || '') ? p.url : null
    })),
    unplanned: tasks.filter((t) => !plannedTaskIds.has(t.task_id)).map((t) => ({ title: t.title, minutes: t.minutes })),
    logged_minutes: tasks.reduce((sum, t) => sum + (t.minutes || 0), 0)
  };
}

/**
 * One local day from Meridian: its stored daily summary (if any) and tracked time.
 * @param {string} dbPath - Path to meridian.db.
 * @param {string} day - Local date, YYYY-MM-DD.
 */
export function collectMeridianDay(dbPath = DEFAULT_MERIDIAN_DB, day) {
  if (!DAY_RE.test(day || '')) return { available: false, reason: 'bad-day' };
  if (!fs.existsSync(dbPath)) return { available: false, reason: 'db-missing' };

  let db;
  try {
    db = openReadOnly(dbPath);
    return {
      available: true,
      day,
      summary: readSummary(db, day),
      time: readDayTime(db, day),
      available_days: db.prepare(SUMMARY_DAYS_SQL).all().map((r) => r.day_local)
    };
  } catch {
    return { available: false, reason: 'db-error' };
  } finally {
    db?.close();
  }
}

/**
 * Seven local days ending on endDay: tracked time, headline, and plan adherence per day.
 * @param {string} dbPath - Path to meridian.db.
 * @param {string} endDay - Last local date in the window, YYYY-MM-DD.
 */
export function collectMeridianWeek(dbPath = DEFAULT_MERIDIAN_DB, endDay) {
  if (!DAY_RE.test(endDay || '')) return { available: false, reason: 'bad-day' };
  if (!fs.existsSync(dbPath)) return { available: false, reason: 'db-missing' };

  let db;
  try {
    db = openReadOnly(dbPath);
    const days = [];
    const totals = { tracked_minutes: 0, idle_minutes: 0, minutes_by_category: {}, plan: { planned: 0, done: 0 } };

    for (let offset = -6; offset <= 0; offset++) {
      const day = shiftDay(endDay, offset);
      const time = readDayTime(db, day);
      const row = db.prepare(SUMMARY_SQL).get(day);
      const adherence = row ? parseJson(row.adherence_json, {}) : {};
      const plan = { planned: adherence.planned || 0, done: adherence.done || 0 };

      days.push({ day, ...time, headline: row?.headline || null, adherence: plan });
      totals.tracked_minutes += time.tracked_minutes;
      totals.idle_minutes += time.idle_minutes;
      for (const [category, minutes] of Object.entries(time.minutes_by_category)) {
        totals.minutes_by_category[category] = (totals.minutes_by_category[category] || 0) + minutes;
      }
      totals.plan.planned += plan.planned;
      totals.plan.done += plan.done;
    }

    return { available: true, start: days[0].day, end: endDay, days, totals };
  } catch {
    return { available: false, reason: 'db-error' };
  } finally {
    db?.close();
  }
}
