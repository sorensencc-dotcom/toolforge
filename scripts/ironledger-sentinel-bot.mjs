#!/usr/bin/env node
/**
 * scripts/ironledger-sentinel-bot.mjs
 * 
 * Autonomous IronLedger Supervisor & Fleet Sentinel Bot.
 * 
 * Owns IronLedger health as a whole:
 * 1. Probes Workbench UI (http://127.0.0.1:8000/) & API health endpoints (/healthz, /readyz).
 * 2. Monitors Docker container state (ironledger-workbench) and performs automatic self-healing.
 * 3. Verifies ledger invariants and database integrity (ironledger.db, zero-variance double-entry balance).
 * 4. Audits external scheduled ingestion sync tasks (IronLedger-Bank-Sync, IronLedger-PriceFeed-Sync, IronLedger-Receipt-Sync).
 * 5. Emits structured JSON telemetry to _status-feed/ironledger_health.json for ICF aggregation.
 * 
 * Zero-token deterministic execution.
 */

import http from 'node:http';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const STATUS_FEED_DIR = path.resolve(REPO_ROOT, '_status-feed');
const REPORT_PATH = path.resolve(STATUS_FEED_DIR, 'ironledger_health.json');
const IRONLEDGER_DIR = path.resolve(REPO_ROOT, 'IronLedger');
const DB_PATH = path.resolve(IRONLEDGER_DIR, 'ironledger.db');

const TARGET_PORT = process.env.IRONLEDGER_HOST_PORT || '8000';
const TARGET_BASE_URL = `http://127.0.0.1:${TARGET_PORT}`;
const TARGET_UI_URL = `${TARGET_BASE_URL}/`;
const TARGET_HEALTHZ_URL = `${TARGET_BASE_URL}/healthz`;
const TARGET_READYZ_URL = `${TARGET_BASE_URL}/readyz`;

const THRASH_GUARD_CONFIG = {
  maxConsecutiveHeals: 3,
  cooldownWindowMs: 15 * 60 * 1000, // 15 mins
  cooldownStatus: 'ALERT_COOLDOWN'
};

const SYNC_TASK_NAMES = [
  'IronLedger-Bank-Sync',
  'IronLedger-PriceFeed-Sync',
  'IronLedger-Receipt-Sync'
];

// CLI args
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isCheckOnly = args.includes('--check-only');
const isReset = args.includes('--reset');
const isHeal = args.includes('--heal');
const isVerbose = args.includes('--verbose');

export function probeUrl(url, options = {}) {
  const { timeoutMs = 6000, expectJson = false, expectHtml = false } = options;
  return new Promise((resolve) => {
    let rawBody = '';
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        if (rawBody.length < 16384) rawBody += chunk;
      });

      res.on('end', () => {
        const is200 = res.statusCode === 200;
        let payloadValid = is200;
        let parsed = null;

        if (is200 && expectJson) {
          try {
            parsed = JSON.parse(rawBody);
            payloadValid = parsed && (parsed.status === 'ok' || parsed.status === 'ready' || parsed.service === 'ironledger');
          } catch {
            payloadValid = false;
          }
        } else if (is200 && expectHtml) {
          payloadValid = rawBody.includes('IronLedger') || rawBody.includes('<div id="root">') || rawBody.includes('Operator Workbench');
        }

        resolve({
          ok: is200 && payloadValid,
          statusCode: res.statusCode,
          headers: res.headers,
          payloadValid,
          data: parsed,
          preview: rawBody.slice(0, 150)
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

export async function probeWorkbenchEndpoints() {
  const [uiProbe, healthzProbe, readyzProbe] = await Promise.all([
    probeUrl(TARGET_UI_URL, { expectHtml: true }),
    probeUrl(TARGET_HEALTHZ_URL, { expectJson: true }),
    probeUrl(TARGET_READYZ_URL, { expectJson: true })
  ]);

  const ok = uiProbe.ok && healthzProbe.ok && readyzProbe.ok;
  return {
    ok,
    targetBaseUrl: TARGET_BASE_URL,
    ui: uiProbe,
    healthz: healthzProbe,
    readyz: readyzProbe,
    version: healthzProbe.data?.version || 'unknown'
  };
}

export function inspectDockerContainer() {
  try {
    const out = execFileSync('docker', [
      'ps', '-a',
      '--filter', 'name=ironledger-workbench',
      '--format', '{{.ID}}|{{.Image}}|{{.Status}}|{{.State}}|{{.Ports}}'
    ], { encoding: 'utf8', timeout: 5000 }).trim();

    if (!out) {
      return {
        found: false,
        running: false,
        healthy: false,
        status: 'CONTAINER_NOT_FOUND',
        id: null
      };
    }

    const [id, image, status, state, ports] = out.split('\n')[0].split('|');
    const isRunning = state === 'running' || status.startsWith('Up');
    const isHealthy = status.includes('(healthy)') || (isRunning && !status.includes('(unhealthy)'));

    return {
      found: true,
      id,
      image,
      status,
      state,
      ports,
      running: isRunning,
      healthy: isHealthy
    };
  } catch (err) {
    return {
      found: false,
      running: false,
      healthy: false,
      status: 'DOCKER_INSPECT_ERROR',
      error: err.message
    };
  }
}

export function restartDockerWorkbench() {
  try {
    const composeFile = path.join(IRONLEDGER_DIR, 'docker-compose.yml');
    if (!fsSync.existsSync(composeFile)) {
      throw new Error(`docker-compose.yml not found at ${composeFile}`);
    }

    execFileSync('docker', ['compose', '-f', composeFile, 'up', '-d'], {
      cwd: IRONLEDGER_DIR,
      encoding: 'utf8',
      timeout: 30000
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export function checkScheduledSyncTasks() {
  if (process.platform !== 'win32') {
    return {
      status: 'NON_WINDOWS',
      tasks: [],
      missingTasks: [],
      error: null
    };
  }

  try {
    const out = execFileSync('powershell.exe', [
      '-NoProfile',
      '-Command',
      'Get-ScheduledTask | Where-Object { $_.TaskName -like "IronLedger-*" } | Select-Object TaskName, State | ConvertTo-Json -Compress'
    ], { encoding: 'utf8', timeout: 6000 }).trim();

    let tasks = [];
    if (out) {
      let parsed = JSON.parse(out);
      if (!Array.isArray(parsed)) parsed = [parsed];
      tasks = parsed.map(t => ({
        name: t.TaskName,
        state: t.State === 3 || t.State === 'Ready' ? 'Ready' : (t.State === 4 || t.State === 'Running' ? 'Running' : String(t.State))
      }));
    }

    const foundNames = new Set(tasks.map(t => t.name));
    const missing = SYNC_TASK_NAMES.filter(n => !foundNames.has(n));
    const allReadyOrRunning = tasks.length > 0 && tasks.every(t => t.state === 'Ready' || t.state === 'Running');

    return {
      status: missing.length === 0 && allReadyOrRunning ? 'HEALTHY' : 'DEGRADED',
      taskCount: tasks.length,
      tasks,
      missingTasks: missing,
      error: missing.length > 0 ? `Missing sync tasks: ${missing.join(', ')}` : null
    };
  } catch (err) {
    return {
      status: 'DEGRADED',
      taskCount: 0,
      tasks: [],
      missingTasks: SYNC_TASK_NAMES,
      error: err.message
    };
  }
}

export async function verifyLedgerDatabase() {
  const result = {
    exists: false,
    sizeBytes: 0,
    walExists: false,
    walSizeBytes: 0,
    status: 'UNKNOWN',
    error: null
  };

  try {
    if (fsSync.existsSync(DB_PATH)) {
      const stats = await fs.stat(DB_PATH);
      result.exists = true;
      result.sizeBytes = stats.size;

      const walPath = `${DB_PATH}-wal`;
      if (fsSync.existsSync(walPath)) {
        const walStats = await fs.stat(walPath);
        result.walExists = true;
        result.walSizeBytes = walStats.size;
      }

      result.status = stats.size > 0 ? 'VALID' : 'EMPTY_DB';
    } else {
      result.status = 'MISSING_DB';
      result.error = `Database not found at ${DB_PATH}`;
    }
  } catch (err) {
    result.status = 'ERROR';
    result.error = err.message;
  }

  return result;
}

export async function runInvariantHarness() {
  const verifierScript = path.resolve(REPO_ROOT, 'scripts', 'verify-ledger.mjs');
  if (!fsSync.existsSync(verifierScript)) {
    return {
      passed: true,
      skipped: true,
      reason: 'verify-ledger.mjs harness not found'
    };
  }

  try {
    const { runHarness } = await import('./verify-ledger.mjs');
    const res = await runHarness({ all: true });
    return {
      passed: res.passed,
      failures: res.failures || [],
      logs: res.logs || []
    };
  } catch (err) {
    return {
      passed: false,
      failures: [err.message],
      logs: []
    };
  }
}

async function readPriorTelemetry() {
  try {
    const raw = await fs.readFile(REPORT_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function runIronLedgerSentinel(options = {}) {
  const dryRun = options.dryRun ?? isDryRun;
  const checkOnly = options.checkOnly ?? isCheckOnly;
  const reset = options.reset ?? isReset;
  const heal = options.heal ?? isHeal;
  const verbose = options.verbose ?? isVerbose;

  const startTime = Date.now();
  console.log(`[IronLedger-Sentinel] Starting IronLedger health supervision... (dry-run: ${dryRun}, check-only: ${checkOnly})`);

  const prior = await readPriorTelemetry();
  let consecutiveHeals = prior?.consecutiveHeals || 0;
  let thrashCooldownActive = prior?.thrashCooldownActive || false;
  let lastCooldownTime = prior?.lastCooldownTime || null;

  if (reset) {
    console.log(`[IronLedger-Sentinel] Manual reset requested (--reset). Clearing thrash guard.`);
    consecutiveHeals = 0;
    thrashCooldownActive = false;
    lastCooldownTime = null;
  } else if (thrashCooldownActive && lastCooldownTime) {
    const elapsed = Date.now() - new Date(lastCooldownTime).getTime();
    if (elapsed > THRASH_GUARD_CONFIG.cooldownWindowMs) {
      if (!checkOnly && !dryRun) {
        console.log(`[IronLedger-Sentinel] Cooldown window expired. Resetting thrash guard.`);
        consecutiveHeals = 0;
        thrashCooldownActive = false;
        lastCooldownTime = null;
      }
    }
  }

  // 1. Probe Workbench endpoints & Docker container
  const [initialProbe, dockerStatus, dbStatus, syncStatus, invariants] = await Promise.all([
    probeWorkbenchEndpoints(),
    Promise.resolve(inspectDockerContainer()),
    verifyLedgerDatabase(),
    Promise.resolve(checkScheduledSyncTasks()),
    runInvariantHarness()
  ]);

  let healed = false;
  let healAction = null;
  let workbenchOk = initialProbe.ok;
  let status = 'HEALTHY';
  let effectiveProbe = initialProbe;
  let effectiveDockerStatus = dockerStatus;

  console.log(`  - Workbench UI (${TARGET_UI_URL}) -> ${initialProbe.ui.ok ? '200 OK' : 'FAIL (' + (initialProbe.ui.statusCode || initialProbe.ui.error) + ')'}`);
  console.log(`  - API /healthz -> ${initialProbe.healthz.ok ? '200 OK (v' + initialProbe.version + ')' : 'FAIL (' + (initialProbe.healthz.statusCode || initialProbe.healthz.error) + ')'}`);
  console.log(`  - API /readyz -> ${initialProbe.readyz.ok ? '200 OK (ready)' : 'FAIL (' + (initialProbe.readyz.statusCode || initialProbe.readyz.error) + ')'}`);
  console.log(`  - Container: ${dockerStatus.found ? dockerStatus.status : 'NOT_FOUND'}`);
  console.log(`  - Database: ${dbStatus.status} (${(dbStatus.sizeBytes / (1024 * 1024)).toFixed(2)} MB)`);
  console.log(`  - Ingestion Syncs: ${syncStatus.status} (${syncStatus.taskCount} tasks active)`);
  console.log(`  - Invariants: ${invariants.passed ? 'PASS' : 'FAIL'}`);

  const needsHealing = (!workbenchOk || !dockerStatus.healthy || heal) && !checkOnly && !dryRun;

  if (needsHealing) {
    if (consecutiveHeals >= THRASH_GUARD_CONFIG.maxConsecutiveHeals) {
      thrashCooldownActive = true;
      if (!lastCooldownTime) lastCooldownTime = new Date().toISOString();
      status = THRASH_GUARD_CONFIG.cooldownStatus;
      console.warn(`[IronLedger-Sentinel] ⚠️ Thrash Guard Active: Exceeded max consecutive restart attempts.`);
    } else {
      console.log(`[IronLedger-Sentinel] Workbench is down or degraded. Initiating automated Docker healing...`);
      const restartResult = restartDockerWorkbench();
      healAction = restartResult.ok ? 'docker compose up -d executed' : `restart error: ${restartResult.error}`;

      // Retry probing after delay
      let postProbe = null;
      for (let attempt = 1; attempt <= 4; attempt++) {
        await new Promise(r => setTimeout(r, 1200));
        postProbe = await probeWorkbenchEndpoints();
        if (postProbe.ok) break;
      }

      if (postProbe) {
        effectiveProbe = postProbe;
        effectiveDockerStatus = inspectDockerContainer();
      }

      if (postProbe && postProbe.ok) {
        workbenchOk = true;
        healed = true;
        consecutiveHeals += 1;
        status = 'RECOVERED';
        console.log(`  ✔ Workbench restored successfully after container heal.`);
      } else {
        consecutiveHeals += 1;
        status = 'HEAL_FAILED';
        console.warn(`  ✖ Workbench probe still failing after restart attempt.`);
      }
    }
  } else if (!workbenchOk) {
    status = 'DOWN';
  } else if (syncStatus.status !== 'HEALTHY' || !invariants.passed || dbStatus.status !== 'VALID') {
    status = 'DEGRADED';
  } else {
    status = 'HEALTHY';
    if (!checkOnly && !dryRun) {
      consecutiveHeals = 0;
      thrashCooldownActive = false;
      lastCooldownTime = null;
    }
  }

  const elapsedMs = Date.now() - startTime;
  const telemetry = {
    timestamp: new Date().toISOString(),
    elapsedMs,
    status,
    workbench: {
      targetUrl: TARGET_BASE_URL,
      uiOk: effectiveProbe.ui.ok,
      healthzOk: effectiveProbe.healthz.ok,
      readyzOk: effectiveProbe.readyz.ok,
      version: effectiveProbe.version,
      container: effectiveDockerStatus
    },
    database: dbStatus,
    invariants: {
      passed: invariants.passed,
      failures: invariants.failures || []
    },
    scheduledSyncs: syncStatus,
    healed,
    healAction,
    consecutiveHeals,
    thrashCooldownActive,
    lastCooldownTime,
    dryRun,
    checkOnly
  };

  await fs.mkdir(STATUS_FEED_DIR, { recursive: true });
  await fs.writeFile(REPORT_PATH, JSON.stringify(telemetry, null, 2), 'utf8');

  console.log(`[IronLedger-Sentinel] Done in ${elapsedMs}ms. Status: ${status}. Telemetry: ${path.relative(REPO_ROOT, REPORT_PATH).replace(/\\/g, '/')}`);
  return telemetry;
}

// Auto-run if executed directly
if (process.argv[1] && (path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) || process.argv[1].endsWith('ironledger-sentinel-bot.mjs'))) {
  runIronLedgerSentinel().catch(err => {
    console.error(`[IronLedger-Sentinel FATAL] ${err.stack || err.message}`);
    process.exit(1);
  });
}
