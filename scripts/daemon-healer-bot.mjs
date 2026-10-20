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
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const REPORT_PATH = path.resolve(REPO_ROOT, '_status-feed', 'daemon_health.json');
const TARGET_DASHBOARD_URL = 'http://127.0.0.1:8080/dashboard';
const TARGET_API_URL = 'http://127.0.0.1:8080/api/reporting/trm-backlog';
const ICF_SERVER_PATH = path.resolve(REPO_ROOT, 'icf', 'src', 'server.mjs');
const ICF_DIR = path.resolve(REPO_ROOT, 'icf');

const SIGIL_DIR = path.resolve(REPO_ROOT, 'sigil-repo');
const SIGIL_ROOMS_DIR = path.resolve(SIGIL_DIR, 'packages', 'sigil-rooms-web');
const TARGET_SIGIL_ROOMS_URL = 'http://127.0.0.1:5173/';

export function resolveRelayPort(customRepoRoot = REPO_ROOT) {
  if (process.env.SIGIL_RELAY_PORT) {
    const p = parseInt(process.env.SIGIL_RELAY_PORT, 10);
    if (!isNaN(p) && p > 0) return { port: p, source: 'env' };
  }
  try {
    const configPath = path.resolve(customRepoRoot, 'sigil-repo', '.sigil', 'config.json');
    if (fsSync.existsSync(configPath)) {
      const parsed = JSON.parse(fsSync.readFileSync(configPath, 'utf8'));
      if (parsed.relay_url) {
        const u = new URL(parsed.relay_url);
        const p = parseInt(u.port, 10);
        if (!isNaN(p) && p > 0) return { port: p, source: '.sigil/config.json' };
      }
    }
  } catch {}
  return { port: 8791, source: 'default' };
}

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isCheckOnly = args.includes('--check-only');
const isReset = args.includes('--reset');
const isVerbose = args.includes('--verbose');

export function probeUrl(url, options = {}) {
  const { timeoutMs = 8000, expectJson = false, expectHtml = false, allowedStatuses = [200], maxBodyLength = 10 * 1024 * 1024 } = options;
  return new Promise((resolve) => {
    let rawBody = '';
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        if (rawBody.length < maxBodyLength) rawBody += chunk;
      });

      res.on('end', () => {
        const isAllowed = allowedStatuses.includes(res.statusCode);
        let payloadValid = isAllowed;
        let parsed = null;

        if (isAllowed && expectJson) {
          try {
            parsed = JSON.parse(rawBody);
            payloadValid = parsed && (parsed.status === 'SUCCESS' || parsed.fleetHealthScore !== undefined || parsed.data !== undefined);
          } catch {
            payloadValid = false;
          }
        } else if (isAllowed && expectHtml) {
          payloadValid = rawBody.includes('<html') || rawBody.includes('<!DOCTYPE') || rawBody.includes('dashboard') || rawBody.includes('Sigil rooms');
        }

        resolve({
          ok: isAllowed && payloadValid,
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

export async function probeSigilRelay(relayPort) {
  return probeUrl(`http://127.0.0.1:${relayPort}/approve`, { expectHtml: true, timeoutMs: 4000 });
}

export async function probeSigilRooms() {
  return probeUrl(TARGET_SIGIL_ROOMS_URL, { expectHtml: true, timeoutMs: 4000 });
}

export async function verifyRelayTrulyDead(relayPort, retries = 3, delayMs = 1000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const probe = await probeSigilRelay(relayPort);
    if (probe.ok) {
      return false; // Still alive
    }
    if (attempt < retries) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return true; // Truly dead after retries
}

function findProcessOnPort(port = 8080) {
  try {
    let extraFilter = '';
    if (port === 8080) {
      extraFilter = ` OR CommandLine LIKE '%http.server%${port}%' OR CommandLine LIKE '%kb-sync/server.mjs%'`;
    } else if (port === 5173) {
      extraFilter = ` OR CommandLine LIKE '%sigil-rooms-web%'`;
    }
    const stdout = execFileSync('powershell.exe', [
      '-NoProfile',
      '-Command',
      `$tcp = Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; ` +
      `$rogue = Get-CimInstance Win32_Process -Filter "CommandLine LIKE '%server.mjs%${port}%'${extraFilter}" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty ProcessId; ` +
      `@($tcp) + @($rogue) | Select-Object -Unique | Where-Object { $_ -gt 0 }`
    ], { encoding: 'utf8' }).trim();

    if (!stdout) return [];
    return stdout.split(/\r?\n/).map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n) && n > 0);
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
      `Start-Process -FilePath "node.exe" -ArgumentList "src/server.mjs" -WorkingDirectory "${ICF_DIR}" -WindowStyle Hidden -PassThru | Select-Object -ExpandProperty Id`
    ], { encoding: 'utf8' }).trim();
    return out || 'launched';
  } catch {
    return null;
  }
}

function startSigilRelay() {
  try {
    const scriptPath = path.resolve(REPO_ROOT, 'scripts', 'run-sigil-daemon.ps1');
    const cmd = `pwsh.exe -NoProfile -WindowStyle Hidden -File "${scriptPath}"`;
    const out = execFileSync('powershell.exe', [
      '-NoProfile',
      '-Command',
      `$task = Get-ScheduledTask -TaskPath "\\Sigil\\" -TaskName 'SigilMeshDaemon' -ErrorAction SilentlyContinue; ` +
      `if ($task) { Start-ScheduledTask -TaskPath "\\Sigil\\" -TaskName 'SigilMeshDaemon'; 'scheduled-task:SigilMeshDaemon' } ` +
      `else { $res = ([wmiclass]"win32_process").Create('${cmd.replace(/'/g, "''")}', '${REPO_ROOT.replace(/'/g, "''")}'); if ($res.ReturnValue -eq 0) { $res.ProcessId } else { 'fail' } }`
    ], { encoding: 'utf8' }).trim();
    return out || 'launched';
  } catch (err) {
    console.error(`[Daemon-Healer] Error launching Sigil Relay: ${err.message}`);
    return null;
  }
}

function startSigilRoomsWeb(relayUrl = 'http://127.0.0.1:8791') {
  try {
    const distHtml = path.resolve(SIGIL_ROOMS_DIR, 'dist', 'index.html');
    if (!fsSync.existsSync(distHtml)) {
      console.warn(`[Daemon-Healer WARNING] Sigil Rooms Web dist not found at ${distHtml}. One-time build required: npm install && npm run build in ${SIGIL_ROOMS_DIR}. Skipping restart to avoid build loop.`);
      return null;
    }

    const binScript = path.resolve(SIGIL_ROOMS_DIR, 'bin', 'sigil-rooms-web.mjs');
    const cmd = `node.exe "${binScript}" --port 5173 --relay-url "${relayUrl}"`;
    const out = execFileSync('powershell.exe', [
      '-NoProfile',
      '-Command',
      `$res = ([wmiclass]"win32_process").Create('${cmd.replace(/'/g, "''")}', '${SIGIL_ROOMS_DIR.replace(/'/g, "''")}'); if ($res.ReturnValue -eq 0) { $res.ProcessId } else { 'fail' }`
    ], { encoding: 'utf8' }).trim();
    return out || 'launched';
  } catch (err) {
    console.error(`[Daemon-Healer] Error launching Sigil Rooms Web: ${err.message}`);
    return null;
  }
}

export const THRASH_GUARD_CONFIG = {
  maxConsecutiveHeals: 3,
  cooldownWindowMs: 60 * 60 * 1000, // 1 hour cooldown window
  cooldownStatus: 'ALERT_ONLY_COOLDOWN'
};

async function readPriorTelemetry() {
  try {
    const raw = await fs.readFile(REPORT_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function runDaemonHealer() {
  const startTime = Date.now();
  const { port: sigilRelayPort, source: sigilPortSource } = resolveRelayPort();
  const sigilRelayUrl = `http://127.0.0.1:${sigilRelayPort}`;

  console.log(`[Daemon-Healer] Checking dashboard daemon health and Sigil mesh (ICF: 8080, Sigil Relay: ${sigilRelayPort} [${sigilPortSource}], Sigil Rooms: 5173)... (dry-run: ${isDryRun}, check-only: ${isCheckOnly})`);

  const prior = await readPriorTelemetry();
  let consecutiveHeals = prior?.consecutiveHeals || 0;
  let thrashCooldownActive = prior?.thrashCooldownActive || false;
  let lastCooldownTime = prior?.lastCooldownTime || null;

  let sigilConsecutiveHeals = prior?.sigilConsecutiveHeals || 0;
  let sigilThrashCooldownActive = prior?.sigilThrashCooldownActive || false;
  let sigilLastCooldownTime = prior?.sigilLastCooldownTime || null;

  if (isReset) {
    console.log(`[Daemon-Healer] Manual reset requested (--reset). Clearing thrash guard counters.`);
    consecutiveHeals = 0;
    thrashCooldownActive = false;
    lastCooldownTime = null;

    sigilConsecutiveHeals = 0;
    sigilThrashCooldownActive = false;
    sigilLastCooldownTime = null;
  } else {
    if (thrashCooldownActive && lastCooldownTime) {
      const elapsed = Date.now() - new Date(lastCooldownTime).getTime();
      if (elapsed > THRASH_GUARD_CONFIG.cooldownWindowMs) {
        if (!isCheckOnly && !isDryRun) {
          console.log(`[Daemon-Healer] ICF Cooldown window expired (${Math.round(elapsed / 60000)}m). Resetting ICF thrash guard.`);
          consecutiveHeals = 0;
          thrashCooldownActive = false;
          lastCooldownTime = null;
        }
      }
    }
    if (sigilThrashCooldownActive && sigilLastCooldownTime) {
      const elapsed = Date.now() - new Date(sigilLastCooldownTime).getTime();
      if (elapsed > THRASH_GUARD_CONFIG.cooldownWindowMs) {
        if (!isCheckOnly && !isDryRun) {
          console.log(`[Daemon-Healer] Sigil Cooldown window expired (${Math.round(elapsed / 60000)}m). Resetting Sigil thrash guard.`);
          sigilConsecutiveHeals = 0;
          sigilThrashCooldownActive = false;
          sigilLastCooldownTime = null;
        }
      }
    }
  }

  // 1. Probe ICF
  const initialProbe = await probeFleetHealth();
  let status = initialProbe.ok ? 'HEALTHY' : 'DOWN';
  let healed = false;
  let restartedPid = null;

  console.log(`  - ICF UI Endpoint ${TARGET_DASHBOARD_URL} -> Status: ${initialProbe.uiProbe?.statusCode || initialProbe.uiProbe?.error} (valid: ${initialProbe.uiProbe?.payloadValid})`);
  console.log(`  - ICF API Endpoint ${TARGET_API_URL} -> Status: ${initialProbe.apiProbe?.statusCode || initialProbe.apiProbe?.error} (valid: ${initialProbe.apiProbe?.payloadValid})`);

  // 2. Probe Sigil
  const [initialSigilRelayProbe, initialSigilRoomsProbe] = await Promise.all([
    probeSigilRelay(sigilRelayPort),
    probeSigilRooms()
  ]);

  let sigilStatus = (initialSigilRelayProbe.ok && initialSigilRoomsProbe.ok) ? 'HEALTHY' : 'DOWN';
  let sigilHealed = false;
  let sigilRelayRestarted = false;
  let sigilRoomsRestarted = false;

  console.log(`  - Sigil Relay http://127.0.0.1:${sigilRelayPort}/approve -> Status: ${initialSigilRelayProbe.statusCode || initialSigilRelayProbe.error} (ok: ${initialSigilRelayProbe.ok})`);
  console.log(`  - Sigil Rooms ${TARGET_SIGIL_ROOMS_URL} -> Status: ${initialSigilRoomsProbe.statusCode || initialSigilRoomsProbe.error} (ok: ${initialSigilRoomsProbe.ok})`);

  // 3. Heal ICF
  if (initialProbe.ok) {
    if (!isCheckOnly && !isDryRun) {
      consecutiveHeals = 0;
      thrashCooldownActive = false;
      lastCooldownTime = null;
    }
    status = 'HEALTHY';
  } else if (!isCheckOnly && !isDryRun) {
    if (consecutiveHeals >= THRASH_GUARD_CONFIG.maxConsecutiveHeals) {
      thrashCooldownActive = true;
      if (!lastCooldownTime) {
        lastCooldownTime = new Date().toISOString();
      }
      status = THRASH_GUARD_CONFIG.cooldownStatus;
      console.warn(`[Daemon-Healer] ⚠️ Thrash Guard Active: Port 8080 flapped >${THRASH_GUARD_CONFIG.maxConsecutiveHeals} consecutive cycles. Switching to alert-only cooldown mode (skipping process eviction).`);
    } else {
      console.log(`[Daemon-Healer] ICF Dashboard is unhealthy, mis-scoped, or colliding. Initiating automated recovery (attempt ${consecutiveHeals + 1}/${THRASH_GUARD_CONFIG.maxConsecutiveHeals})...`);
      const stalePids = findProcessOnPort(8080);
      for (const pid of stalePids) {
        console.log(`  - Terminating stale/colliding process on port 8080 (PID: ${pid})`);
        killProcess(pid);
      }

      await new Promise((r) => setTimeout(r, 800));
      restartedPid = startDashboardDaemon();
      console.log(`  - Launched fresh HTTP server rooted at ${ICF_DIR} (PID: ${restartedPid})`);

      let postProbe = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        await new Promise((r) => setTimeout(r, 800));
        postProbe = await probeFleetHealth();
        if (postProbe.ok) break;
      }

      if (postProbe && postProbe.ok) {
        status = 'RECOVERED';
        healed = true;
        consecutiveHeals += 1;
        console.log('  ✔ ICF Health check passed after restart (UI & API 200 OK).');
      } else {
        status = 'RESTART_FAILED';
        consecutiveHeals += 1;
        console.warn(`  ✖ ICF Health check still failing after restart.`);
      }
    }
  }

  // 4. Heal Sigil (Relay first, then Web Client)
  if (initialSigilRelayProbe.ok && initialSigilRoomsProbe.ok) {
    if (!isCheckOnly && !isDryRun) {
      sigilConsecutiveHeals = 0;
      sigilThrashCooldownActive = false;
      sigilLastCooldownTime = null;
    }
    sigilStatus = 'HEALTHY';
  } else if (!isCheckOnly && !isDryRun) {
    if (sigilConsecutiveHeals >= THRASH_GUARD_CONFIG.maxConsecutiveHeals) {
      sigilThrashCooldownActive = true;
      if (!sigilLastCooldownTime) {
        sigilLastCooldownTime = new Date().toISOString();
      }
      sigilStatus = THRASH_GUARD_CONFIG.cooldownStatus;
      console.warn(`[Daemon-Healer] ⚠️ Thrash Guard Active: Sigil mesh/web flapped >${THRASH_GUARD_CONFIG.maxConsecutiveHeals} consecutive cycles. Switching to alert-only cooldown mode (skipping restart).`);
    } else {
      console.log(`[Daemon-Healer] Sigil mesh or web client is unhealthy. Initiating ordered recovery (attempt ${sigilConsecutiveHeals + 1}/${THRASH_GUARD_CONFIG.maxConsecutiveHeals})...`);

      // Step A: Relay check and recovery
      let relayNeedsRestart = false;
      if (!initialSigilRelayProbe.ok) {
        const trulyDead = await verifyRelayTrulyDead(sigilRelayPort, 3, 1000);
        if (trulyDead) {
          relayNeedsRestart = true;
          console.warn('[Daemon-Healer WARNING] ⚠️ Sigil Relay restart erases in-memory room state (all rooms, memberships, and active invocations reset to clean slate). Initiating restart only after confirming relay is truly dead across multiple probes.');
          const staleRelayPids = findProcessOnPort(sigilRelayPort);
          for (const pid of staleRelayPids) {
            console.log(`  - Terminating stale process on port ${sigilRelayPort} (PID: ${pid})`);
            killProcess(pid);
          }
          const relayLaunchRes = startSigilRelay();
          console.log(`  - Triggered Sigil Relay mesh startup (${relayLaunchRes})`);
          sigilRelayRestarted = true;

          // Poll relay up to 12 attempts (6s)
          let relayReady = false;
          for (let i = 0; i < 12; i++) {
            await new Promise((r) => setTimeout(r, 500));
            const p = await probeSigilRelay(sigilRelayPort);
            if (p.ok) { relayReady = true; break; }
          }
          if (relayReady) {
            console.log(`  ✔ Sigil Relay is now listening and responsive on port ${sigilRelayPort}.`);
          } else {
            console.warn(`  ✖ Sigil Relay did not become ready on port ${sigilRelayPort}.`);
          }
        } else {
          console.log('  ✔ Sigil Relay recovered during multi-probe check (transient slow probe; skipping wipe-inducing restart).');
        }
      }

      // Step B: Web client check and recovery
      if (!initialSigilRoomsProbe.ok || relayNeedsRestart) {
        console.log(`  - Checking/restarting Sigil Rooms Web client on port 5173...`);
        const staleWebPids = findProcessOnPort(5173);
        for (const pid of staleWebPids) {
          console.log(`  - Terminating stale process on port 5173 (PID: ${pid})`);
          killProcess(pid);
        }

        const webLaunchRes = startSigilRoomsWeb(sigilRelayUrl);
        if (webLaunchRes) {
          console.log(`  - Launched fresh Sigil Rooms Web server on port 5173 (${webLaunchRes})`);
          sigilRoomsRestarted = true;

          // Poll web client up to 8 attempts (4s)
          let webReady = false;
          for (let i = 0; i < 8; i++) {
            await new Promise((r) => setTimeout(r, 500));
            const p = await probeSigilRooms();
            if (p.ok) { webReady = true; break; }
          }
          if (webReady) {
            console.log('  ✔ Sigil Rooms Web client is now responsive at http://127.0.0.1:5173/.');
          } else {
            console.warn('  ✖ Sigil Rooms Web client did not become ready on port 5173.');
          }
        }
      }

      // Re-probe post healing
      const [finalRelay, finalRooms] = await Promise.all([
        probeSigilRelay(sigilRelayPort),
        probeSigilRooms()
      ]);

      if (finalRelay.ok && finalRooms.ok) {
        sigilStatus = 'RECOVERED';
        sigilHealed = true;
        sigilConsecutiveHeals += 1;
        console.log('  ✔ Sigil mesh and rooms web client fully recovered.');
      } else {
        sigilStatus = 'RESTART_FAILED';
        sigilConsecutiveHeals += 1;
        console.warn(`  ✖ Sigil recovery failed (Relay ok: ${finalRelay.ok}, Rooms ok: ${finalRooms.ok}).`);
      }
    }
  }

  const elapsedMs = Date.now() - startTime;
  const telemetry = {
    timestamp: new Date().toISOString(),
    elapsedMs,
    targetUrl: TARGET_DASHBOARD_URL,
    targetApiUrl: TARGET_API_URL,
    status,
    consecutiveHeals,
    thrashCooldownActive,
    lastCooldownTime,
    initialProbe: {
      ok: initialProbe.ok,
      statusCode: initialProbe.statusCode,
      uiProbe: initialProbe.uiProbe,
      apiProbe: initialProbe.apiProbe
    },
    healed,
    restartedPid,
    // Sigil telemetry surface
    sigilRelayUrl,
    sigilRoomsUrl: TARGET_SIGIL_ROOMS_URL,
    sigilRelayPort,
    sigilRelayPortSource: sigilPortSource,
    sigilStatus,
    sigilConsecutiveHeals,
    sigilThrashCooldownActive,
    sigilLastCooldownTime,
    sigilInitialProbe: {
      relay: initialSigilRelayProbe,
      rooms: initialSigilRoomsProbe
    },
    sigilHealed,
    sigilRelayRestarted,
    sigilRoomsRestarted,
    dryRun: isDryRun,
    checkOnly: isCheckOnly
  };

  await fs.mkdir(path.dirname(REPORT_PATH), { recursive: true });
  await fs.writeFile(REPORT_PATH, JSON.stringify(telemetry, null, 2), 'utf8');

  console.log(`[Daemon-Healer] Done in ${elapsedMs}ms. Status: ICF=${status}, Sigil=${sigilStatus}. Telemetry: ${path.relative(REPO_ROOT, REPORT_PATH).replace(/\\/g, '/')}`);
  return telemetry;
}

runDaemonHealer().catch((err) => {
  console.error(`[Daemon-Healer FATAL] ${err.stack || err.message}`);
  process.exit(1);
});

