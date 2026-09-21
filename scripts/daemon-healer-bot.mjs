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
const TARGET_URL = 'http://127.0.0.1:8080/dashboard';
const ICF_SERVER_PATH = path.resolve(REPO_ROOT, 'icf', 'src', 'server.mjs');
const ICF_DIR = path.resolve(REPO_ROOT, 'icf');

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isCheckOnly = args.includes('--check-only');
const isVerbose = args.includes('--verbose');

function probeUrl(url, timeoutMs = 2500) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      resolve({
        ok: res.statusCode === 200,
        statusCode: res.statusCode,
        headers: res.headers
      });
      res.resume(); // consume stream to free up memory
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

function findProcessOnPort(port = 8080) {
  try {
    const stdout = execFileSync('powershell.exe', [
      '-NoProfile',
      '-Command',
      `Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique`
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
    execFileSync('powershell.exe', [
      '-NoProfile',
      '-Command',
      `Start-Process -FilePath "node.exe" -ArgumentList "${ICF_SERVER_PATH}" -WorkingDirectory "${ICF_DIR}" -WindowStyle Hidden`
    ], { cwd: REPO_ROOT, stdio: 'ignore' });
    return 'launched-via-start-process';
  } catch {
    return null;
  }
}

async function runDaemonHealer() {
  const startTime = Date.now();
  console.log(`[Daemon-Healer] Checking dashboard daemon health... (dry-run: ${isDryRun})`);

  const initialProbe = await probeUrl(TARGET_URL);
  let status = initialProbe.ok ? 'HEALTHY' : 'DOWN';
  let healed = false;
  let restartedPid = null;

  console.log(`  - Endpoint ${TARGET_URL} -> Status: ${initialProbe.statusCode || initialProbe.error}`);

  if (!initialProbe.ok && !isCheckOnly && !isDryRun) {
    console.log('[Daemon-Healer] Service is unhealthy or mis-scoped. Initiating automated recovery...');
    const stalePids = findProcessOnPort(8080);
    for (const pid of stalePids) {
      console.log(`  - Terminating stale process on port 8080 (PID: ${pid})`);
      killProcess(pid);
    }

    // Short wait for socket release
    await new Promise(r => setTimeout(r, 800));

    restartedPid = startDashboardDaemon();
    console.log(`  - Launched fresh HTTP server rooted at ${REPO_ROOT} (PID: ${restartedPid})`);

    // Verify recovery
    await new Promise(r => setTimeout(r, 1200));
    const postProbe = await probeUrl(TARGET_URL);
    if (postProbe.ok) {
      status = 'RECOVERED';
      healed = true;
      console.log('  ✔ Health check passed after restart (200 OK).');
    } else {
      status = 'RESTART_FAILED';
      console.warn(`  ✖ Health check still failing after restart (${postProbe.statusCode || postProbe.error}).`);
    }
  }

  const elapsedMs = Date.now() - startTime;
  const telemetry = {
    timestamp: new Date().toISOString(),
    elapsedMs,
    targetUrl: TARGET_URL,
    status,
    initialProbe,
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
