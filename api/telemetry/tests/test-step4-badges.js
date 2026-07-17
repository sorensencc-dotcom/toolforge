'use strict';

// ============================================================
// Integration tests for Phase 2b Step 4 — badge endpoints + /tools listing.
// No test framework (matches the plain-assertion style of
// utilities/tests/test-step3-release-automation.ps1). Spawns the real
// server as a child process against the real run-store.db, seeds
// uniquely-prefixed synthetic tool rows so assertions are deterministic
// regardless of whatever else is in the log, then deletes those rows on
// exit so production telemetry data is left untouched.
//
// Run: node tests/test-step4-badges.js   (from api/telemetry/)
// ============================================================

const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const sqlite3 = require('sqlite3');

const DB_PATH = path.join(__dirname, '..', '..', '..', 'run-store.db');
const SERVER_PATH = path.join(__dirname, '..', 'server.js');
// A non-default port: keeps this test isolated from whatever else may be
// bound to :3000 on the dev box (found live: an unrelated pre-existing
// python.exe process was squatting on :3000, which silently made an
// earlier draft of this test "pass" a health check against the wrong
// server entirely — see waitForHealth()'s payload-shape check below).
const PORT = 3099;
const PREFIX = '__test4_';

let pass = 0;
let fail = 0;

function assert(cond, label) {
  if (cond) {
    console.log(`  PASS: ${label}`);
    pass++;
  } else {
    console.log(`  FAIL: ${label}`);
    fail++;
  }
}

function get(pathAndQuery) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: PORT, path: pathAndQuery,
      headers: { Authorization: 'Bearer test-telemetry-key' } }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    }).on('error', reject);
  });
}

function waitForHealth(retries) {
  return get('/health').then((res) => {
    let parsed;
    try { parsed = JSON.parse(res.body); } catch (e) { parsed = null; }
    // Validate payload shape, not just "request didn't reject" — a stray
    // unrelated process on the same port can respond 200/404 with a body
    // that isn't ours (found live, see PORT comment above).
    if (parsed && parsed.status === 'healthy' && parsed.db === 'run-store.db') return res;
    throw new Error(`unexpected /health payload: ${res.body.slice(0, 200)}`);
  }).catch((e) => {
    if (retries <= 0) throw new Error(`server did not become healthy in time: ${e.message}`);
    return new Promise((r) => setTimeout(r, 300)).then(() => waitForHealth(retries - 1));
  });
}

function isoAgo(ms) { return new Date(Date.now() - ms).toISOString(); }

function seed(db) {
  return new Promise((resolve, reject) => {
    const now = () => new Date().toISOString();
    const stmts = [];

    // tools rows (FK target for runs/errors)
    const tools = [
      `${PREFIX}online`, `${PREFIX}degraded`, `${PREFIX}down`,
      `${PREFIX}latency`, `${PREFIX}errors`, `${PREFIX}nodata_latency`
    ];

    db.serialize(() => {
      db.run('BEGIN IMMEDIATE');
      tools.forEach((t) => {
        db.run(
          `INSERT INTO tools (name, first_seen, last_run) VALUES (?, ?, ?)
           ON CONFLICT(name) DO UPDATE SET last_run = excluded.last_run`,
          [t, now(), now()]
        );
      });

      function insertRun(tool, status, durationMs, errorCode) {
        const id = `${PREFIX}${tool}-${Math.random().toString(36).slice(2)}`;
        db.run(
          `INSERT INTO runs (invocation_id, tool, timestamp, duration_ms, status, error_code, error_message, version)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, tool, isoAgo(60 * 1000), durationMs, status, errorCode || null, errorCode ? 'seeded failure' : null, '0.0.0-test']
        );
        return id;
      }

      // online: 10/10 success -> 0% fail rate -> ONLINE
      for (let i = 0; i < 10; i++) insertRun(`${PREFIX}online`, 'success', 50, null);

      // degraded: 20 runs, 2 fail -> 10% -> DEGRADED (>5%, <=20%)
      for (let i = 0; i < 18; i++) insertRun(`${PREFIX}degraded`, 'success', 50, null);
      for (let i = 0; i < 2; i++) insertRun(`${PREFIX}degraded`, 'fail', 50, 'E_RUNTIME');

      // down: 10 runs, 3 fail -> 30% -> DOWN (>20%)
      for (let i = 0; i < 7; i++) insertRun(`${PREFIX}down`, 'success', 50, null);
      for (let i = 0; i < 3; i++) insertRun(`${PREFIX}down`, 'fail', 50, 'E_RUNTIME');

      // latency: 5 successful runs with known durations -> nearest-rank p95 of
      // [100,200,300,400,500] is index ceil(0.95*5)-1 = 4 -> 500ms
      [100, 200, 300, 400, 500].forEach((d) => insertRun(`${PREFIX}latency`, 'success', d, null));

      // nodata_latency: registered tool, zero runs -> badge must say "no data", not crash
      // (no runs inserted intentionally)

      // errors: 1 run that fails + 3 matching errors rows within 24h window
      const errRunId = insertRun(`${PREFIX}errors`, 'fail', 75, 'E_VALIDATION');
      for (let i = 0; i < 3; i++) {
        db.run(
          `INSERT INTO errors (error_id, invocation_id, tool, timestamp, error_code, error_message, stack_trace)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [`${PREFIX}err-${i}-${Math.random().toString(36).slice(2)}`, errRunId, `${PREFIX}errors`, isoAgo(60 * 1000), 'E_VALIDATION', 'seeded error', null]
        );
      }

      db.run('COMMIT', (err) => (err ? reject(err) : resolve()));
    });
  });
}

function cleanup(db) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN IMMEDIATE');
      db.run(`DELETE FROM errors WHERE tool LIKE '${PREFIX}%'`);
      db.run(`DELETE FROM runs WHERE tool LIKE '${PREFIX}%'`);
      db.run(`DELETE FROM tools WHERE name LIKE '${PREFIX}%'`);
      db.run('COMMIT', (err) => (err ? reject(err) : resolve()));
    });
  });
}

async function main() {
  const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READWRITE);
  await new Promise((r) => db.run('PRAGMA busy_timeout=5000;', r));

  console.log('Seeding synthetic tool telemetry...');
  await seed(db);

  console.log('Starting server...');
  const child = spawn(process.execPath, [SERVER_PATH], {
    cwd: path.join(__dirname, '..'),
    stdio: 'pipe',
    env: { ...process.env, TELEMETRY_API_KEY: 'test-telemetry-key', PORT: String(PORT) }
  });
  let serverLog = '';
  child.stdout.on('data', (d) => { serverLog += d.toString(); });
  child.stderr.on('data', (d) => { serverLog += d.toString(); });

  try {
    await waitForHealth(20);

    console.log('\n--- /api/toolforge/tools ---');
    const toolsRes = await get('/api/toolforge/tools');
    const toolsBody = JSON.parse(toolsRes.body);
    const names = toolsBody.tools.map((t) => t.name);
    assert(toolsRes.status === 200, 'GET /tools returns 200');
    assert(names.includes(`${PREFIX}online`), '/tools includes seeded tool');
    assert(!names.includes('system'), "/tools excludes placeholder 'system' row");

    console.log('\n--- badge/health ---');
    let r = await get(`/api/toolforge/badge/health/${PREFIX}online`);
    assert(r.status === 200, 'health(online) 200');
    assert(r.headers['content-type'].startsWith('image/svg+xml'), 'health(online) content-type is svg');
    assert(r.headers['cache-control'] === 'public, max-age=300', 'health(online) cache-control overridden to public/300s');
    assert(/ONLINE/.test(r.body), 'health(online) message is ONLINE');
    assert(/#3fb950/.test(r.body), 'health(online) color is green');

    r = await get(`/api/toolforge/badge/health/${PREFIX}degraded`);
    assert(/DEGRADED/.test(r.body), 'health(degraded) message is DEGRADED for 10% fail rate');
    assert(/#d4a72c/.test(r.body), 'health(degraded) color is amber');

    r = await get(`/api/toolforge/badge/health/${PREFIX}down`);
    assert(/DOWN/.test(r.body), 'health(down) message is DOWN for 30% fail rate');
    assert(/#da3633/.test(r.body), 'health(down) color is red');

    r = await get(`/api/toolforge/badge/health/${PREFIX}nonexistent_zzz`);
    assert(/UNKNOWN/.test(r.body), 'health(nonexistent tool) falls back to UNKNOWN, does not 500');
    assert(r.status === 200, 'health(nonexistent tool) still returns 200 (valid embeddable badge)');

    console.log('\n--- badge/latency ---');
    r = await get(`/api/toolforge/badge/latency/${PREFIX}latency`);
    assert(/500ms/.test(r.body), 'latency p95 nearest-rank of [100..500] is 500ms');

    r = await get(`/api/toolforge/badge/latency/${PREFIX}nodata_latency`);
    assert(/no data/.test(r.body), 'latency with zero runs renders "no data" instead of crashing');
    assert(r.status === 200, 'latency with zero runs still returns 200');

    console.log('\n--- badge/errors ---');
    r = await get(`/api/toolforge/badge/errors/${PREFIX}errors`);
    assert(/>3</.test(r.body), 'errors badge shows seeded 24h error count (3)');
    assert(/#da3633/.test(r.body), 'errors badge is red when count > 0');

    r = await get(`/api/toolforge/badge/errors/${PREFIX}online`);
    assert(/>0</.test(r.body), 'errors badge shows 0 for a tool with no errors');
    assert(/#3fb950/.test(r.body), 'errors badge is green when count == 0');

    console.log('\n--- long tool name does not produce malformed SVG ---');
    const longName = `${PREFIX}` + 'x'.repeat(60);
    // Register it so the health query has a row to match against (still 0 runs -> UNKNOWN, that's fine).
    r = await get(`/api/toolforge/badge/health/${encodeURIComponent(longName)}`);
    assert(r.status === 200, 'long tool name still returns 200');
    assert(/<svg/.test(r.body) && /<\/svg>/.test(r.body), 'long tool name produces well-formed SVG');

  } finally {
    child.kill();
    await cleanup(db);
    db.close();
  }

  console.log(`\n=== Step 4 test summary: ${pass} passed, ${fail} failed ===`);
  if (fail > 0) {
    console.log('\n--- server log (for diagnosis) ---');
    console.log(serverLog);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('Test run crashed:', err);
  process.exitCode = 1;
});
