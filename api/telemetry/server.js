'use strict';

// ============================================================
// Toolforge Telemetry API — read-only Express server over run-store.db
// Phase 2b Step 1 (see docs/meta/toolforge-phase-2b-step1-design.md §2)
// ============================================================

const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3');
const path = require('path');

// DB_PATH derived from __dirname, never from env / committed absolute path (C12).
const DB_PATH = path.join(__dirname, '..', '..', 'run-store.db');
const PORT = process.env.PORT || 3000;

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

app.get('/api/toolforge/runs', listRuns);
app.get('/api/toolforge/runs/:invocationId', getRun);
app.get('/api/toolforge/tools/:tool/stats', getToolStats);
app.get('/health', health);

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
});

module.exports = app;
