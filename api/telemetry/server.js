'use strict';

// ============================================================
// Toolforge Telemetry API — read-only Express server over run-store.db
// Phase 2b Step 1 (see docs/meta/toolforge-phase-2b-step1-design.md §2)
// ============================================================

const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// DB_PATH derived from __dirname, never from env / committed absolute path (C12).
const DB_PATH = path.join(__dirname, '..', '..', 'run-store.db');
const PORT = process.env.PORT || 3001;

// ---- Single process-lifetime DB handle (no pool; read-only workload) ----
const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('[toolforge-api] failed to open run-store.db:', err.message);
    process.exit(1);
  }
});

db.serialize(() => {
  db.run('PRAGMA foreign_keys = ON;');
  db.run('PRAGMA busy_timeout = 5000;');
});

// ---- Dedicated read-write handle for the alert engine ONLY (D9). ----
// The HTTP `db` above stays OPEN_READONLY so no request path can ever mutate.
// WAL permits this single writer alongside readers (API) + the PS hook writer.
const dbWrite = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READWRITE, (err) => {
  if (err) {
    console.error('[toolforge-api] failed to open run-store.db (rw for alerts):', err.message);
    // Do NOT exit — the read API must keep serving even if alerts can't write.
  }
});
dbWrite.serialize(() => {
  dbWrite.run('PRAGMA foreign_keys = ON;');
  dbWrite.run('PRAGMA busy_timeout = 5000;');
  // [Rule 1 auto-fix] alerts.tool has FOREIGN KEY -> tools(name). System-scoped
  // alerts (error_spike, fail_rate) write tool='system', but no tool ever
  // registers that name (found live via E2E smoke test: createAlert failed with
  // SQLITE_CONSTRAINT FOREIGN KEY). Seed a placeholder tools row once so the FK
  // resolves — data-only fix, no schema.sql change (§0.1 "No schema change" honored).
  const nowIso = new Date().toISOString();
  dbWrite.run(
    `INSERT INTO tools (name, first_seen, last_run) VALUES ('system', ?, ?)
     ON CONFLICT(name) DO NOTHING;`,
    [nowIso, nowIso],
    (err) => { if (err) console.error('[toolforge-api] failed to seed system tools row:', err.message); }
  );
});

const THRESHOLDS_PATH = path.join(__dirname, '..', '..', 'config', 'alert-thresholds.json');

const DEFAULT_THRESHOLDS = {
  evaluation_interval_minutes: 5,
  alerts: [
    { name: 'error_spike', threshold: 10, window_minutes: 10, error_codes: ['E_RUNTIME'], enabled: true },
    { name: 'fail_rate', threshold: 0.15, window_minutes: 60, min_samples: 10, enabled: true },
    { name: 'duration_anomaly', threshold_multiplier: 2.0, window_minutes: 60, baseline_days: 7,
      percentile: 99, min_samples: 20, min_baseline_samples: 30, enabled: true }
  ]
};

function loadThresholds() {
  try {
    const parsed = JSON.parse(fs.readFileSync(THRESHOLDS_PATH, 'utf8'));
    if (!parsed || !Array.isArray(parsed.alerts)) throw new Error('missing alerts[]');
    return parsed;
  } catch (e) {
    console.warn('[toolforge-api] alert-thresholds.json unreadable; using defaults:', e.message);
    return DEFAULT_THRESHOLDS;
  }
}
const THRESHOLDS = loadThresholds();

// ---- Error classes -> HTTP status (resolves C8) ----
class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
class BadRequestError extends ApiError {
  constructor(m) { super(400, 'BAD_REQUEST', m); }
}
class NotFoundError extends ApiError {
  constructor(m) { super(404, 'NOT_FOUND', m); }
}

// ---- Validation helpers ----
function parseIntParam(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return n;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

// Accepts 'YYYY-MM-DD' or a full ISO datetime. Expands date-only 'from' to
// start-of-day, 'to' to end-of-day (inclusive). Throws BadRequestError if
// unparseable.
function parseDateBoundary(value, boundary) {
  if (value === undefined || value === null || value === '') return null;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/;
  let iso;
  if (dateOnly.test(value)) {
    iso = boundary === 'from' ? `${value}T00:00:00.000Z` : `${value}T23:59:59.999Z`;
  } else {
    iso = value;
  }
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestError(`Invalid ${boundary} date: ${value}`);
  }
  return iso;
}

function validateStatus(value) {
  if (value === undefined || value === null || value === '') return null;
  if (value !== 'success' && value !== 'fail') {
    throw new BadRequestError(`Invalid status: ${value}. Must be 'success' or 'fail'.`);
  }
  return value;
}

function validateTool(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > 200) {
    throw new BadRequestError('Invalid tool: must be a string of at most 200 characters.');
  }
  return value;
}

const WINDOW_MS = { '24h': 24 * 60 * 60 * 1000, '7d': 7 * 24 * 60 * 60 * 1000 };
const ERROR_CODES = ['E_RUNTIME', 'E_VALIDATION', 'E_DEPENDENCY', 'E_ENVIRONMENT', 'E_TIMEOUT'];

function isoAgo(ms) { return new Date(Date.now() - ms).toISOString(); }

function validateWindow(value) {
  const w = value || '24h';
  if (w !== '24h' && w !== '7d' && w !== 'all') {
    throw new BadRequestError(`Invalid window: ${value}. Must be '24h', '7d', or 'all'.`);
  }
  return w;
}

function validateErrorCode(value) {
  if (value === undefined || value === null || value === '') return null;
  if (!ERROR_CODES.includes(value)) {
    throw new BadRequestError(`Invalid error_code: ${value}. Must be one of ${ERROR_CODES.join(', ')}.`);
  }
  return value;
}

function validateAlertStatus(value) {
  const s = value || 'active';
  if (s !== 'active' && s !== 'resolved' && s !== 'all') {
    throw new BadRequestError(`Invalid status: ${value}. Must be 'active', 'resolved', or 'all'.`);
  }
  return s;
}

function percentileNearestRank(sortedAsc, p) {
  // sortedAsc: numbers ascending. Nearest-rank: idx = ceil(p/100 * N) (1-indexed).
  const n = sortedAsc.length;
  if (n === 0) return null;
  const idx = Math.min(n, Math.max(1, Math.ceil((p / 100) * n))) - 1;
  return sortedAsc[idx];
}

// Builds a shared WHERE clause + param array from validated query filters.
function buildWhere({ tool, status, from, to }) {
  const clauses = [];
  const params = [];

  if (tool) {
    clauses.push('tool = ?');
    params.push(tool);
  }
  if (status) {
    clauses.push('status = ?');
    params.push(status);
  }
  if (from) {
    clauses.push('timestamp >= ?');
    params.push(from);
  }
  if (to) {
    clauses.push('timestamp <= ?');
    params.push(to);
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  return { where, params };
}

// ---- App setup ----
const app = express();
app.disable('x-powered-by');

const corsOptions = {
  origin(origin, cb) {
    // Allow file:// callers. Per the Fetch spec, an opaque (file://) origin
    // serializes to the literal string "null" in the Origin header — browsers
    // do not omit the header entirely, so both cases must be handled (fixes
    // a design-doc snippet bug found via live file:// E2E test: the header
    // is never actually undefined for a real browser request).
    if (!origin || origin === 'null') return cb(null, true);
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return cb(null, true);
    return cb(new Error('CORS: origin not allowed'));
  },
  methods: ['GET'],
  optionsSuccessStatus: 204
};
app.use(cors(corsOptions));

function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
  next();
}
app.use(securityHeaders);

// ============================================================
// Routes — base path /api/toolforge, all GET
// ============================================================

// Route 1: GET /api/toolforge/runs
function listRuns(req, res, next) {
  try {
    const limit = clamp(parseIntParam(req.query.limit, 25), 1, 100);
    const offset = Math.max(0, parseIntParam(req.query.offset, 0));
    const tool = validateTool(req.query.tool);
    const status = validateStatus(req.query.status);
    const from = parseDateBoundary(req.query.from, 'from');
    const to = parseDateBoundary(req.query.to, 'to');

    const { where, params } = buildWhere({ tool, status, from, to });

    const pageSql = `SELECT invocation_id, tool, timestamp, duration_ms, status, error_code, error_message, version
                     FROM runs ${where}
                     ORDER BY timestamp DESC
                     LIMIT ? OFFSET ?`;
    const aggSql = `SELECT COUNT(*) total,
                            SUM(status='success') success_count,
                            SUM(status='fail') fail_count,
                            ROUND(AVG(duration_ms),1) avg_duration_ms
                     FROM runs ${where}`;

    db.all(pageSql, [...params, limit, offset], (err, rows) => {
      if (err) return next(err);

      db.get(aggSql, params, (aggErr, agg) => {
        if (aggErr) return next(aggErr);

        const total = agg.total || 0;
        const successCount = agg.success_count || 0;
        const failCount = agg.fail_count || 0;
        const successRatePct = total > 0 ? Math.round((100 * successCount / total) * 10) / 10 : 0;

        const returned = rows.length;
        const hasNext = offset + returned < total;
        const hasPrev = offset > 0;

        res.status(200).json({
          runs: rows,
          pagination: { limit, offset, total, returned, hasNext, hasPrev },
          stats: {
            total_runs: total,
            success_count: successCount,
            fail_count: failCount,
            success_rate_pct: successRatePct,
            avg_duration_ms: agg.avg_duration_ms || 0
          }
        });
      });
    });
  } catch (e) {
    next(e);
  }
}

// Route 2: GET /api/toolforge/runs/:invocationId
function getRun(req, res, next) {
  const { invocationId } = req.params;
  db.get('SELECT * FROM runs WHERE invocation_id = ?', [invocationId], (err, row) => {
    if (err) return next(err);
    if (!row) return next(new NotFoundError('Run not found'));
    res.status(200).json(row);
  });
}

// Route 3: GET /api/toolforge/tools/:tool/stats?window=24h
function getToolStats(req, res, next) {
  const { tool } = req.params;
  const window = req.query.window || '24h';

  let cutoffClause = '';
  let cutoffParams = [];

  if (window === '24h') {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    cutoffClause = 'AND timestamp > ?';
    cutoffParams = [cutoff];
  } else if (window === '7d') {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    cutoffClause = 'AND timestamp > ?';
    cutoffParams = [cutoff];
  } else if (window === 'all') {
    cutoffClause = '';
    cutoffParams = [];
  } else {
    return next(new BadRequestError(`Invalid window: ${window}. Must be '24h', '7d', or 'all'.`));
  }

  const sql = `SELECT COUNT(*) total_runs,
                      SUM(CASE WHEN status='success' THEN 1 ELSE 0 END) success_count,
                      SUM(CASE WHEN status='fail'    THEN 1 ELSE 0 END) fail_count,
                      ROUND(AVG(duration_ms),1) avg_duration_ms,
                      MAX(duration_ms) max_duration_ms,
                      MIN(duration_ms) min_duration_ms
               FROM runs
               WHERE tool = ? ${cutoffClause}`;

  db.get(sql, [tool, ...cutoffParams], (err, row) => {
    if (err) return next(err);

    const totalRuns = row.total_runs || 0;
    const successCount = row.success_count || 0;
    const failCount = row.fail_count || 0;
    const successRatePct = totalRuns > 0 ? Math.round((100 * successCount / totalRuns) * 10) / 10 : 0;

    res.status(200).json({
      tool,
      window,
      stats: {
        total_runs: totalRuns,
        success_count: successCount,
        fail_count: failCount,
        success_rate_pct: successRatePct,
        avg_duration_ms: row.avg_duration_ms || null,
        max_duration_ms: row.max_duration_ms || null,
        min_duration_ms: row.min_duration_ms || null
      }
    });
  });
}

// Route 4: GET /health
function health(req, res) {
  db.get('SELECT COUNT(*) AS run_count FROM runs', [], (err, row) => {
    if (err) {
      console.error('[toolforge-api]', err);
      return res.status(500).json({
        status: 'unhealthy',
        error: { code: 'INTERNAL', message: 'Internal server error' }
      });
    }
    res.status(200).json({
      status: 'healthy',
      runs_recorded: row.run_count,
      db: 'run-store.db'
    });
  });
}

// Route 5: GET /api/toolforge/errors
function listErrors(req, res, next) {
  try {
    const tool = validateTool(req.query.tool);
    const errorCode = validateErrorCode(req.query.error_code);
    const window = validateWindow(req.query.window);
    const limit = clamp(parseIntParam(req.query.limit, 50), 1, 200);
    const offset = Math.max(0, parseIntParam(req.query.offset, 0));

    const clauses = [];
    const params = [];
    if (window !== 'all') { clauses.push('timestamp > ?'); params.push(isoAgo(WINDOW_MS[window])); }
    if (tool)      { clauses.push('tool = ?');        params.push(tool); }
    if (errorCode) { clauses.push('error_code = ?');  params.push(errorCode); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const pageSql = `SELECT error_id, invocation_id, tool, timestamp, error_code, error_message, stack_trace
                     FROM errors ${where}
                     ORDER BY timestamp DESC
                     LIMIT ? OFFSET ?`;
    const countSql = `SELECT COUNT(*) total FROM errors ${where}`;

    db.all(pageSql, [...params, limit, offset], (err, rows) => {
      if (err) return next(err);
      db.get(countSql, params, (cErr, c) => {
        if (cErr) return next(cErr);
        const total = c.total || 0;
        const returned = rows.length;
        res.status(200).json({
          errors: rows,
          pagination: {
            limit, offset, total, returned,
            hasNext: offset + returned < total,
            hasPrev: offset > 0
          }
        });
      });
    });
  } catch (e) { next(e); }
}

// Route 6: GET /api/toolforge/errors/taxonomy
function errorTaxonomy(req, res, next) {
  try {
    const window = validateWindow(req.query.window);
    const clause = window !== 'all' ? 'WHERE timestamp > ?' : '';
    const params = window !== 'all' ? [isoAgo(WINDOW_MS[window])] : [];

    const sql = `SELECT error_code, COUNT(*) count, GROUP_CONCAT(DISTINCT tool) tools
                 FROM errors ${clause}
                 GROUP BY error_code
                 ORDER BY count DESC`;

    db.all(sql, params, (err, rows) => {
      if (err) return next(err);
      const total = rows.reduce((s, r) => s + r.count, 0);
      res.status(200).json({ taxonomy: rows, total, window });
    });
  } catch (e) { next(e); }
}

// Route 7: GET /api/toolforge/alerts
function listAlerts(req, res, next) {
  try {
    const window = validateWindow(req.query.window);
    const statusFilter = validateAlertStatus(req.query.status);
    const limit = clamp(parseIntParam(req.query.limit, 100), 1, 500);

    const clauses = [];
    const params = [];
    if (window !== 'all')       { clauses.push('timestamp > ?'); params.push(isoAgo(WINDOW_MS[window])); }
    if (statusFilter !== 'all') { clauses.push('status = ?');    params.push(statusFilter); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const sql = `SELECT alert_id, tool, timestamp, alert_type, threshold_value, actual_value, status
                 FROM alerts ${where}
                 ORDER BY timestamp DESC
                 LIMIT ?`;

    db.all(sql, [...params, limit], (err, rows) => {
      if (err) return next(err);
      res.status(200).json({ alerts: rows, count: rows.length, window, status: statusFilter });
    });
  } catch (e) { next(e); }
}

// Route 8: GET /api/toolforge/tools
// [Rule 2 auto-add] The plan's Step 4 Badges-tab snippet derived the tool
// list by fetching `runs?limit=1` and de-duping — that only ever sees the
// single most-recent run's tool, so the badges grid would show at most one
// tool. A real listing endpoint is required for "Badges tab displays all
// tools" (Step 4.2 success criterion) to be achievable at all.
function listTools(req, res, next) {
  // 'system' is a placeholder row seeded for the alerts FK (see dbWrite.serialize
  // above) and is not a real tool — exclude it from the public listing.
  db.all(
    `SELECT name, category, version, first_seen, last_run FROM tools WHERE name != 'system' ORDER BY name ASC`,
    [],
    (err, rows) => {
      if (err) return next(err);
      res.status(200).json({ tools: rows, count: rows.length });
    }
  );
}

// ============================================================
// Badges (Step 4). Read-only SVG generation over `db`, small in-memory
// cache to bound query volume if a README/dashboard embeds many badges
// (risk mitigation table: "Badge endpoint overload -> Cache badges 5min").
// ============================================================
const BADGE_CACHE_TTL_MS = 5 * 60 * 1000;
const badgeCache = new Map(); // key -> { expires: number, svg: string }

function getCachedBadge(key) {
  const hit = badgeCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.svg;
  if (hit) badgeCache.delete(key);
  return null;
}

function setCachedBadge(key, svg) {
  badgeCache.set(key, { expires: Date.now() + BADGE_CACHE_TTL_MS, svg });
}

// Approximate flat-square text width (no canvas available server-side).
// Good enough to avoid clipped/overlapping labels for real tool names.
function textWidth(s) {
  return Math.round(String(s).length * 6.5) + 14;
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// label side uses the CIC "iron" tone; value side uses a semantic status
// color (kept close to shields.io convention so badges scan correctly at a
// glance regardless of surrounding theme — READMEs render on GitHub's own
// light/dark chrome, not the dashboard's).
function generateBadgeSvg(label, message, color) {
  const labelText = escapeXml(label);
  const messageText = escapeXml(message);
  const labelW = textWidth(labelText);
  const msgW = textWidth(messageText);
  const totalW = labelW + msgW;
  const labelX = Math.round(labelW / 2);
  const msgX = labelW + Math.round(msgW / 2);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="20" role="img" aria-label="${labelText}: ${messageText}">
  <g shape-rendering="crispEdges">
    <rect width="${labelW}" height="20" fill="#1e1a17"/>
    <rect x="${labelW}" width="${msgW}" height="20" fill="${color}"/>
  </g>
  <g fill="#e8e0d4" text-anchor="middle" font-family="Verdana,Geneva,sans-serif" font-size="11">
    <text x="${labelX}" y="14">${labelText}</text>
    <text x="${msgX}" y="14">${messageText}</text>
  </g>
</svg>`;
}

function sendBadge(res, cacheKey, label, message, color) {
  let svg = getCachedBadge(cacheKey);
  if (!svg) {
    svg = generateBadgeSvg(label, message, color);
    setCachedBadge(cacheKey, svg);
  }
  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300'); // overrides global no-store (C12-style: badges are embeddable, must be cacheable)
  res.status(200).send(svg);
}

const BADGE_COLORS = {
  online: '#3fb950',
  degraded: '#d4a72c',
  down: '#da3633',
  unknown: '#9a9088',
  neutral: '#B8922A',
  error: '#da3633',
  clean: '#3fb950'
};

// Route 9: GET /api/toolforge/badge/health/:tool
function badgeHealth(req, res, next) {
  const { tool } = req.params;
  const cutoff = isoAgo(WINDOW_MS['24h']);

  db.get(
    `SELECT COUNT(*) total, SUM(CASE WHEN status='fail' THEN 1 ELSE 0 END) fail_count
     FROM runs WHERE tool = ? AND timestamp > ?`,
    [tool, cutoff],
    (err, row) => {
      if (err) return next(err);
      const total = row.total || 0;
      const fails = row.fail_count || 0;

      let health = 'unknown';
      let color = BADGE_COLORS.unknown;
      if (total > 0) {
        const failRate = fails / total;
        if (failRate > 0.2) { health = 'down'; color = BADGE_COLORS.down; }
        else if (failRate > 0.05) { health = 'degraded'; color = BADGE_COLORS.degraded; }
        else { health = 'online'; color = BADGE_COLORS.online; }
      }

      sendBadge(res, `health:${tool}`, tool, health.toUpperCase(), color);
    }
  );
}

// Route 10: GET /api/toolforge/badge/latency/:tool — p95 over last 24h, successful runs only.
function badgeLatency(req, res, next) {
  const { tool } = req.params;
  const cutoff = isoAgo(WINDOW_MS['24h']);

  db.all(
    `SELECT duration_ms FROM runs WHERE tool = ? AND status = 'success' AND timestamp > ? ORDER BY duration_ms ASC`,
    [tool, cutoff],
    (err, rows) => {
      if (err) return next(err);
      if (!rows.length) {
        return sendBadge(res, `latency:${tool}`, 'latency', 'no data', BADGE_COLORS.unknown);
      }
      const p95 = percentileNearestRank(rows.map((r) => r.duration_ms), 95);
      sendBadge(res, `latency:${tool}`, 'p95 latency', `${p95}ms`, BADGE_COLORS.neutral);
    }
  );
}

// Route 11: GET /api/toolforge/badge/errors/:tool — count over last 24h.
function badgeErrors(req, res, next) {
  const { tool } = req.params;
  const cutoff = isoAgo(WINDOW_MS['24h']);

  db.get(
    `SELECT COUNT(*) c FROM errors WHERE tool = ? AND timestamp > ?`,
    [tool, cutoff],
    (err, row) => {
      if (err) return next(err);
      const count = row.c || 0;
      const color = count > 0 ? BADGE_COLORS.error : BADGE_COLORS.clean;
      sendBadge(res, `errors:${tool}`, 'errors (24h)', String(count), color);
    }
  );
}

// ============================================================
// Alert engine (Step 2). Internal scheduler; writes via dbWrite only.
// ============================================================
function logEngineError(err) { console.error('[toolforge-api][alerts]', err.message); }

function getAlertCfg(name) {
  return (THRESHOLDS.alerts || []).find((a) => a.name === name && a.enabled);
}

// Idempotency: suppress a duplicate active alert of the same (type, tool) while one
// already exists inside the alert's window (acts as a cooldown). After the window
// elapses, a fresh alert may fire even if the old one is still 'active' — no resolver
// is in Step 2 scope. Single-timer engine + one dbWrite handle => the check-then-insert
// race is practically nil (documented, accepted).
function maybeCreateAlert(type, tool, actualValue, thresholdValue, cooldownMinutes) {
  const cooldownCutoff = isoAgo(cooldownMinutes * 60 * 1000);
  dbWrite.get(
    `SELECT 1 FROM alerts WHERE alert_type = ? AND tool = ? AND status = 'active' AND timestamp > ? LIMIT 1`,
    [type, tool, cooldownCutoff],
    (err, row) => {
      if (err) return logEngineError(err);
      if (row) return; // active alert within cooldown -> suppress duplicate
      createAlert(type, tool, actualValue, thresholdValue);
    }
  );
}

function createAlert(type, tool, actualValue, thresholdValue) {
  const alertId = crypto.randomUUID();
  const ts = new Date().toISOString();
  dbWrite.run(
    `INSERT INTO alerts (alert_id, tool, timestamp, alert_type, threshold_value, actual_value, status)
     VALUES (?, ?, ?, ?, ?, ?, 'active')`,
    [alertId, tool || 'system', ts, type, thresholdValue, actualValue],
    (err) => {
      if (err) console.error('[toolforge-api][alerts] createAlert failed:', err.message);
      else console.log(`[toolforge-api][alerts] created type=${type} tool=${tool} actual=${actualValue} threshold=${thresholdValue}`);
    }
  );
}

function evalErrorSpike(cfg) {
  const cutoff = isoAgo(cfg.window_minutes * 60 * 1000);
  const codes = (cfg.error_codes && cfg.error_codes.length) ? cfg.error_codes : ['E_RUNTIME'];
  const placeholders = codes.map(() => '?').join(',');
  dbWrite.get(
    `SELECT COUNT(*) c FROM errors WHERE timestamp > ? AND error_code IN (${placeholders})`,
    [cutoff, ...codes],
    (err, row) => {
      if (err) return logEngineError(err);
      const count = row.c || 0;
      if (count > cfg.threshold) {
        maybeCreateAlert('error_spike', 'system', count, cfg.threshold, cfg.window_minutes);
      }
    }
  );
}

function evalFailRate(cfg) {
  const cutoff = isoAgo(cfg.window_minutes * 60 * 1000);
  const minSamples = cfg.min_samples != null ? cfg.min_samples : 10;
  dbWrite.get(
    `SELECT COUNT(*) total, SUM(CASE WHEN status='fail' THEN 1 ELSE 0 END) fails
     FROM runs WHERE timestamp > ?`,
    [cutoff],
    (err, row) => {
      if (err) return logEngineError(err);
      const total = row.total || 0;
      const fails = row.fails || 0;
      if (total < minSamples) return; // small-sample guard (no false positives)
      const rate = fails / total;
      if (rate > cfg.threshold) {
        const rounded = Math.round(rate * 10000) / 10000;
        maybeCreateAlert('fail_rate', 'system', rounded, cfg.threshold, cfg.window_minutes);
      }
    }
  );
}

function evalDurationAnomaly(cfg) {
  const winCutoff = isoAgo(cfg.window_minutes * 60 * 1000);
  const baseDays = cfg.baseline_days != null ? cfg.baseline_days : 7;
  const baseCutoff = isoAgo(baseDays * 24 * 60 * 60 * 1000);
  const minWin = cfg.min_samples != null ? cfg.min_samples : 20;
  const minBase = cfg.min_baseline_samples != null ? cfg.min_baseline_samples : 30;
  const mult = cfg.threshold_multiplier != null ? cfg.threshold_multiplier : 2.0;
  const pct = cfg.percentile != null ? cfg.percentile : 99;

  // Tools with enough samples in the window.
  dbWrite.all(
    `SELECT tool, COUNT(*) n FROM runs WHERE timestamp > ? GROUP BY tool HAVING n >= ?`,
    [winCutoff, minWin],
    (err, tools) => {
      if (err) return logEngineError(err);
      tools.forEach((t) => {
        // Rolling baseline average over baseline_days.
        dbWrite.get(
          `SELECT AVG(duration_ms) avg, COUNT(*) n FROM runs WHERE tool = ? AND timestamp > ?`,
          [t.tool, baseCutoff],
          (bErr, base) => {
            if (bErr) return logEngineError(bErr);
            if (!base || base.n < minBase || !base.avg || base.avg <= 0) return;
            // p99 within the window (nearest-rank, computed in JS).
            dbWrite.all(
              `SELECT duration_ms d FROM runs WHERE tool = ? AND timestamp > ? ORDER BY duration_ms ASC`,
              [t.tool, winCutoff],
              (pErr, rows) => {
                if (pErr) return logEngineError(pErr);
                if (!rows.length) return;
                const p99 = percentileNearestRank(rows.map((r) => r.d), pct);
                const threshold = mult * base.avg;
                if (p99 > threshold) {
                  maybeCreateAlert('duration_anomaly', t.tool, p99, Math.round(threshold * 10) / 10, cfg.window_minutes);
                }
              }
            );
          }
        );
      });
    }
  );
}

function evaluateAlerts() {
  const spike = getAlertCfg('error_spike');       if (spike) evalErrorSpike(spike);
  const rate = getAlertCfg('fail_rate');          if (rate) evalFailRate(rate);
  const dur = getAlertCfg('duration_anomaly');    if (dur) evalDurationAnomaly(dur);
}

app.get('/api/toolforge/runs', listRuns);
app.get('/api/toolforge/runs/:invocationId', getRun);
app.get('/api/toolforge/tools/:tool/stats', getToolStats);
app.get('/health', health);
app.get('/api/toolforge/errors', listErrors);
app.get('/api/toolforge/errors/taxonomy', errorTaxonomy);
app.get('/api/toolforge/alerts', listAlerts);
app.get('/api/toolforge/tools', listTools);
app.get('/api/toolforge/badge/health/:tool', badgeHealth);
app.get('/api/toolforge/badge/latency/:tool', badgeLatency);
app.get('/api/toolforge/badge/errors/:tool', badgeErrors);

// ---- 404 + central error handler (resolves C8) ----
function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
}
app.use(notFoundHandler);

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  }
  console.error('[toolforge-api]', err);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Internal server error' } });
}
app.use(errorHandler);

app.listen(PORT, '127.0.0.1', () => {
  console.log(`[toolforge-api] listening on http://127.0.0.1:${PORT}`);
  console.log(`[toolforge-api] db: ${DB_PATH}`);
  const intervalMin = THRESHOLDS.evaluation_interval_minutes || 5;
  console.log(`[toolforge-api][alerts] engine every ${intervalMin}m`);
  evaluateAlerts();                                   // first pass at boot
  setInterval(evaluateAlerts, intervalMin * 60 * 1000);
});

module.exports = app;
