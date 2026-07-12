/**
 * Step 1–2 API Endpoint Tests
 * Tests all telemetry, stats, error, and alert endpoints
 */

'use strict';

const http = require('http');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3');

const TEST_DB_PATH = path.join(__dirname, '../../test-run-store.db');
const API_PORT = 3099;  // Avoid port conflicts
const API_BASE = `http://127.0.0.1:${API_PORT}`;

// ============================================================
// Test Utils
// ============================================================

function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: API_PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Connection': 'close'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data ? JSON.parse(data) : null,
            raw: data
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: null,
            raw: data
          });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function seedDatabase(dbPath) {
  return new Promise((resolve, reject) => {
    // Ensure test db dir exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Initialize schema
    const schemaPath = path.join(__dirname, '../../schema.sql');
    if (!fs.existsSync(schemaPath)) {
      reject(new Error(`schema.sql not found at ${schemaPath}`));
      return;
    }

    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }

    const db = new sqlite3.Database(dbPath);

    db.serialize(() => {
      db.run('PRAGMA foreign_keys = ON;');

      // Read and execute schema
      const schema = fs.readFileSync(schemaPath, 'utf-8');
      const statements = schema.split(';').filter(s => s.trim());

      let executed = 0;
      statements.forEach(stmt => {
        db.run(stmt, (err) => {
          if (err) console.warn('Schema statement failed:', err);
          executed++;
          if (executed === statements.length) {
            // Seed test data
            seedTestData(db, dbPath, resolve, reject);
          }
        });
      });
    });
  });
}

function seedTestData(db, dbPath, resolve, reject) {
  db.serialize(() => {
    const now = new Date().toISOString();
    const onehourAgo = new Date(Date.now() - 3600000).toISOString();

    // Insert test tools
    db.run(
      'INSERT INTO tools (name, category, version) VALUES (?, ?, ?)',
      ['analyze-token', 'analysis', '1.0.0']
    );

    db.run(
      'INSERT INTO tools (name, category, version) VALUES (?, ?, ?)',
      ['deploy-service', 'deployment', '2.1.0']
    );

    // Insert test runs
    db.run(
      `INSERT INTO runs (invocation_id, tool, timestamp, duration_ms, status, version)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['inv-001', 'analyze-token', now, 120, 'success', '1.0.0']
    );

    db.run(
      `INSERT INTO runs (invocation_id, tool, timestamp, duration_ms, status, version)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['inv-002', 'analyze-token', onehourAgo, 85, 'success', '1.0.0']
    );

    db.run(
      `INSERT INTO runs (invocation_id, tool, timestamp, duration_ms, status, error_code, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['inv-003', 'deploy-service', onehourAgo, 45, 'fail', 'E_DEPENDENCY', 'Docker daemon unavailable']
    );

    db.run(
      `INSERT INTO runs (invocation_id, tool, timestamp, duration_ms, status, error_code, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['inv-004', 'deploy-service', now, 60, 'fail', 'E_TIMEOUT', 'Deployment timed out'],
      (err) => {
        if (err) {
          reject(err);
          return;
        }

        // Insert test errors
        db.run(
          `INSERT INTO errors (error_id, invocation_id, tool, timestamp, error_code, error_message)
           VALUES (?, ?, ?, ?, ?, ?)`,
          ['err-001', 'inv-003', 'deploy-service', onehourAgo, 'E_DEPENDENCY', 'Docker daemon unavailable']
        );

        db.run(
          `INSERT INTO errors (error_id, invocation_id, tool, timestamp, error_code, error_message)
           VALUES (?, ?, ?, ?, ?, ?)`,
          ['err-002', 'inv-004', 'deploy-service', now, 'E_TIMEOUT', 'Deployment timed out'],
          (err) => {
            db.close((closeErr) => {
              if (err || closeErr) {
                reject(err || closeErr);
              } else {
                resolve(dbPath);
              }
            });
          }
        );
      }
    );
  });
}

// ============================================================
// Tests
// ============================================================

async function runTests() {
  console.log('Seeding test database...');
  try {
    await seedDatabase(TEST_DB_PATH);
  } catch (err) {
    console.error('Failed to seed database:', err.message);
    process.exit(1);
  }

  // Fork API server on test port
  console.log(`Starting API server on port ${API_PORT}...`);
  const serverChild = require('child_process').spawn('node', [
    path.join(__dirname, '../server.js')
  ], {
    env: { ...process.env, PORT: API_PORT, DB_PATH: TEST_DB_PATH },
    stdio: 'pipe'
  });

  serverChild.stderr.on('data', (data) => {
    console.log(`[server stderr] ${data}`);
  });

  // Give server time to start
  await new Promise(r => setTimeout(r, 1000));

  let testCount = 0;
  let passCount = 0;

  const tests = [
    {
      name: 'GET /health',
      fn: async () => {
        const res = await makeRequest('GET', '/health');
        if (res.status !== 200) throw new Error(`Status ${res.status}`);
        if (!res.body.status) throw new Error('Missing status field');
        return true;
      }
    },
    {
      name: 'GET /api/toolforge/runs',
      fn: async () => {
        const res = await makeRequest('GET', '/api/toolforge/runs?limit=10');
        if (res.status !== 200) throw new Error(`Status ${res.status}`);
        if (!Array.isArray(res.body.runs)) throw new Error('Missing runs array');
        if (res.body.runs.length < 2) throw new Error('Expected at least 2 runs');
        return true;
      }
    },
    {
      name: 'GET /api/toolforge/runs (filter by tool)',
      fn: async () => {
        const res = await makeRequest('GET', '/api/toolforge/runs?tool=analyze-token&limit=10');
        if (res.status !== 200) throw new Error(`Status ${res.status}`);
        if (res.body.runs.some(r => r.tool !== 'analyze-token')) {
          throw new Error('Filter not applied correctly');
        }
        return true;
      }
    },
    {
      name: 'GET /api/toolforge/runs (filter by status)',
      fn: async () => {
        const res = await makeRequest('GET', '/api/toolforge/runs?status=fail&limit=10');
        if (res.status !== 200) throw new Error(`Status ${res.status}`);
        if (res.body.runs.some(r => r.status !== 'fail')) {
          throw new Error('Status filter not applied');
        }
        return true;
      }
    },
    {
      name: 'GET /api/toolforge/runs/:invocationId',
      fn: async () => {
        const res = await makeRequest('GET', '/api/toolforge/runs/inv-001');
        if (res.status !== 200) throw new Error(`Status ${res.status}`);
        if (res.body.invocation_id !== 'inv-001') throw new Error('Wrong invocation ID');
        return true;
      }
    },
    {
      name: 'GET /api/toolforge/tools/:tool/stats',
      fn: async () => {
        const res = await makeRequest('GET', '/api/toolforge/tools/analyze-token/stats?window=24h');
        if (res.status !== 200) throw new Error(`Status ${res.status}`);
        if (!res.body.stats) throw new Error('Missing stats');
        if (res.body.stats.total_runs < 2) throw new Error('Expected at least 2 runs for analyze-token');
        if (typeof res.body.stats.fail_rate_pct !== 'number') throw new Error('Missing fail_rate_pct');
        return true;
      }
    },
    {
      name: 'GET /api/toolforge/errors',
      fn: async () => {
        const res = await makeRequest('GET', '/api/toolforge/errors?limit=10');
        if (res.status !== 200) throw new Error(`Status ${res.status}`);
        if (!Array.isArray(res.body.errors)) throw new Error('Missing errors array');
        if (res.body.errors.length < 2) throw new Error('Expected at least 2 errors');
        return true;
      }
    },
    {
      name: 'GET /api/toolforge/errors (filter by tool)',
      fn: async () => {
        const res = await makeRequest('GET', '/api/toolforge/errors?tool=deploy-service&limit=10');
        if (res.status !== 200) throw new Error(`Status ${res.status}`);
        if (res.body.errors.some(e => e.tool !== 'deploy-service')) {
          throw new Error('Tool filter not applied');
        }
        return true;
      }
    },
    {
      name: 'GET /api/toolforge/errors/taxonomy',
      fn: async () => {
        const res = await makeRequest('GET', '/api/toolforge/errors/taxonomy?window=24h');
        if (res.status !== 200) throw new Error(`Status ${res.status}`);
        if (!Array.isArray(res.body.taxonomy)) throw new Error('Missing taxonomy array');
        const codes = res.body.taxonomy.map(t => t.error_code);
        if (!codes.includes('E_DEPENDENCY') || !codes.includes('E_TIMEOUT')) {
          throw new Error('Expected error codes in taxonomy');
        }
        return true;
      }
    },
    {
      name: 'GET /api/toolforge/tools',
      fn: async () => {
        const res = await makeRequest('GET', '/api/toolforge/tools');
        if (res.status !== 200) throw new Error(`Status ${res.status}`);
        if (!Array.isArray(res.body.tools)) throw new Error('Missing tools array');
        if (res.body.tools.length < 2) throw new Error('Expected at least 2 tools');
        return true;
      }
    },
    {
      name: 'GET /api/toolforge/badge/health/:tool',
      fn: async () => {
        const res = await makeRequest('GET', '/api/toolforge/badge/health/analyze-token');
        if (res.status !== 200) throw new Error(`Status ${res.status}`);
        if (!res.raw.includes('<svg')) throw new Error('Not an SVG');
        return true;
      }
    }
  ];

  for (const test of tests) {
    testCount++;
    try {
      await test.fn();
      console.log(`✓ ${test.name}`);
      passCount++;
    } catch (err) {
      console.log(`✗ ${test.name}: ${err.message}`);
    }
  }

  // Cleanup
  serverChild.kill();
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }

  console.log(`\nStep 1–2 API Tests: ${passCount}/${testCount} PASSED`);
  process.exit(passCount === testCount ? 0 : 1);
}

runTests().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
