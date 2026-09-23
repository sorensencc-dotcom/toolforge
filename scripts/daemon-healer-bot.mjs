#!/usr/bin/env node
/**
 * scripts/daemon-healer-bot.mjs
 * 
 * Autonomous Dashboard & Local Daemon Supervisor Bot.
 * Probes HTTP endpoints (http://127.0.0.1:8080/modules/wiki/dashboard.html),
 * detects dead, hung, or mis-scoped server processes on port 8080,
 * and automatically restarts the background daemon rooted at C:\dev.
 * Zero-token deterministic execution.
 */

import http from 'node:http';
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const REPORT_PATH = path.resolve(REPO_ROOT, '_status-feed', 'daemon_health.json');
const TARGET_DASHBOARD_URL = 'http://127.0.0.1:8080/dashboard';
const TARGET_API_URL = 'http://127.0.0.1:8080/api/reporting/ironbots';
const ICF_SERVER_PATH = path.resolve(REPO_ROOT, 'icf', 'src', 'server.mjs');
const ICF_DIR = path.resolve(REPO_ROOT, 'icf');

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isCheckOnly = args.includes('--check-only');
const isVerbose = args.includes('--verbose');

function probeUrl(url, options = {}) {
  const { timeoutMs = 2500, expectJson = false, expectHtml = false } = options;
  return new Promise((resolve) => {
    let rawBody = '';
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        if (rawBody.length < 8192) rawBody += chunk;
      });

      res.on('end', () => {
        const is200 = res.statusCode === 200;
        let payloadValid = is200;
        let parsed = null;

        if (is200 && expectJson) {
          try {
            parsed = JSON.parse(rawBody);
            payloadValid = parsed && (parsed.status === 'SUCCESS' || parsed.fleetHealthScore !== undefined || parsed.data !== undefined);
          } catch {
            payloadValid = false;
          }
        } else if (is200 && expectHtml) {
          payloadValid = rawBody.includes('<html') || rawBody.includes('<!DOCTYPE') || rawBody.includes('dashboard');
        }

        resolve({
          ok: is200 && payloadValid,
          statusCode: res.statusCode,
          headers: res.headers,
          payloadValid,
          preview: rawBody.slice(0, 120)
        });
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, error: 'TIMEOUT', statusCode: 0 });
    });

    req.on('error', (err) => {
      resolve({ ok: false, error: err.code || err.message, statusCode: 0 });
    });
  });
}

async function probeFleetHealth() {
  const [uiProbe, apiProbe] = await Promise.all([
    probeUrl(TARGET_DASHBOARD_URL, { expectHtml: true }),
    probeUrl(TARGET_API_URL, { expectJson: true })
  ]);

  const ok = uiProbe.ok && apiProbe.ok;
  return {
    ok,
    uiProbe,
    apiProbe,
    statusCode: uiProbe.statusCode || apiProbe.statusCode || 0,
    error: uiProbe.ok ? apiProbe.error : uiProbe.error
  };
}

function findProcessOnPort(port = 8080) {
  try {
    const stdout = execFileSync('powershell.exe', [
      '-NoProfile',
      '-Command',
      `$tcp = Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; ` +
      `$rogue = Get-CimInstance Win32_Process -Filter "CommandLine LIKE '%http.server%${port}%' OR CommandLine LIKE '%kb-sync/server.mjs%'" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty ProcessId; ` +
      `@($tcp) + @($rogue) | Select-Object -Unique | Where-Object { $_ -gt 0 }`
    ], { encoding: 'utf8' }).trim();

    if (!stdout) return [];
    return stdout.split(/\r?\n/).map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n > 0);
  } catch {
    return [];
  }
}

function killProcess(pid) {
  try {
    execFileSync('taskkill', ['/F', '/PID', String(pid)], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function startDashboardDaemon() {
  try {
    const out = execFileSync('powershell.exe', [
      '-NoProfile',
      '-Command',
      `Start-Process -FilePath "node.exe" -ArgumentList "src/server.mjs" -WorkingDirectory "${ICF_DIR}" -PassThru | Select-Object -ExpandProperty Id`
    ], { encoding: 'utf8' }).trim();
    return out || 'launched';
  } catch {
    return null;
  }
}

async function runDaemonHealer() {
  const startTime = Date.now();
  console.log(`[Daemon-Healer] Checking dashboard daemon health... (dry-run: ${isDryRun})`);

  const initialProbe = await probeFleetHealth();
  let status = initialProbe.ok ? 'HEALTHY' : 'DOWN';
  let healed = false;
  let restartedPid = null;

  console.log(`  - UI Endpoint ${TARGET_DASHBOARD_URL} -> Status: ${initialProbe.uiProbe?.statusCode || initialProbe.uiProbe?.error} (valid: ${initialProbe.uiProbe?.payloadValid})`);
  console.log(`  - API Endpoint ${TARGET_API_URL} -> Status: ${initialProbe.apiProbe?.statusCode || initialProbe.apiProbe?.error} (valid: ${initialProbe.apiProbe?.payloadValid})`);

  if (!initialProbe.ok && !isCheckOnly && !isDryRun) {
    console.log('[Daemon-Healer] Service is unhealthy, mis-scoped, or colliding. Initiating automated recovery...');
    const stalePids = findProcessOnPort(8080);
    for (const pid of stalePids) {
      console.log(`  - Terminating stale/colliding process on port 8080 (PID: ${pid})`);
      killProcess(pid);
    }

    // Short wait for socket release
    await new Promise(r => setTimeout(r, 800));

    restartedPid = startDashboardDaemon();
    console.log(`  - Launched fresh HTTP server rooted at ${ICF_DIR} (PID: ${restartedPid})`);

    // Verify recovery with retries
    let postProbe = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      await new Promise(r => setTimeout(r, 800));
      postProbe = await probeFleetHealth();
      if (postProbe.ok) break;
    }

    if (postProbe && postProbe.ok) {
      status = 'RECOVERED';
      healed = true;
      console.log('  ✔ Health check passed after restart (UI & API 200 OK).');
    } else {
      status = 'RESTART_FAILED';
      console.warn(`  ✖ Health check still failing after restart (UI: ${postProbe?.uiProbe?.statusCode || postProbe?.uiProbe?.error}, API: ${postProbe?.apiProbe?.statusCode || postProbe?.apiProbe?.error}).`);
    }
  }

  const elapsedMs = Date.now() - startTime;
  const telemetry = {
    timestamp: new Date().toISOString(),
    elapsedMs,
    targetUrl: TARGET_DASHBOARD_URL,
    targetApiUrl: TARGET_API_URL,
    status,
    initialProbe: {
      ok: initialProbe.ok,
      statusCode: initialProbe.statusCode,
      uiProbe: initialProbe.uiProbe,
      apiProbe: initialProbe.apiProbe
    },
    healed,
    restartedPid,
    dryRun: isDryRun
  };

  await fs.mkdir(path.dirname(REPORT_PATH), { recursive: true });
  await fs.writeFile(REPORT_PATH, JSON.stringify(telemetry, null, 2), 'utf8');

  console.log(`[Daemon-Healer] Done in ${elapsedMs}ms. Status: ${status}. Telemetry: ${path.relative(REPO_ROOT, REPORT_PATH).replace(/\\/g, '/')}`);
  return telemetry;
}

runDaemonHealer().catch(err => {
  console.error(`[Daemon-Healer FATAL] ${err.stack || err.message}`);
  process.exit(1);
});
