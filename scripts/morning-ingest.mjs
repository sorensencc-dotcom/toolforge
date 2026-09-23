import path from 'node:path';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { collectIcfTelemetry, writePrometheusMetrics } from '../modules/telemetry/icf-ingestion-hook.mjs';
import { IcfWebSocketServer } from '../modules/telemetry/icf-ws-server.mjs';

const REPO_ROOT = process.cwd();
const VAULT_ROOT = process.env.OBSIDIAN_VAULT_ROOT || path.join(REPO_ROOT, 'obsidian', 'vault');

async function runMorningIngestion() {
  const args = process.argv.slice(2);
  const streamMode = args.includes('--stream') || process.env.ICF_STREAM === '1';

  console.log('[ICF] Gathering morning ingestion telemetry...');
  const telemetry = collectIcfTelemetry(REPO_ROOT, VAULT_ROOT);

  // 1. Emit console telemetry for ICF Console
  console.log(`[ICF-TELEMETRY] status=${telemetry.overall_status} worktrees=${telemetry.active_worktrees_count} staging_batches=${telemetry.vault_status.staged_batches}`);

  // 2. Write JSON artifact for ICF UI / CLI readers
  const icfReportPath = path.join(REPO_ROOT, '.icf-telemetry-latest.json');
  fs.writeFileSync(icfReportPath, JSON.stringify(telemetry, null, 2), 'utf8');

  // 3. Prometheus / Grafana metrics exporter (textfile collector)
  const promLocalPath = path.join(REPO_ROOT, '.icf-telemetry.prom');
  writePrometheusMetrics(telemetry, promLocalPath);

  if (process.env.PROMETHEUS_TEXTFILE_DIR && fs.existsSync(process.env.PROMETHEUS_TEXTFILE_DIR)) {
    const promGlobalPath = path.join(process.env.PROMETHEUS_TEXTFILE_DIR, 'icf.prom');
    writePrometheusMetrics(telemetry, promGlobalPath);
  }

  // 4. Append receipt to Vault Log
  const potentialLogPaths = [
    path.join(VAULT_ROOT, 'wiki', 'Log.md'),
    path.join(VAULT_ROOT, 'Log.md'),
    path.join(REPO_ROOT, 'wiki', 'Log.md')
  ];

  const logPath = potentialLogPaths.find(p => fs.existsSync(p));
  if (logPath) {
    const logEntry = `\n##### ${telemetry.timestamp} — ICF Ingestion Telemetry\n- **Status:** ${telemetry.overall_status}\n- **Worktrees Monitored:** ${telemetry.active_worktrees_count}\n- **Vault Sync Staging:** ${telemetry.vault_status.staging_active ? 'Active' : 'Idle'} (${telemetry.vault_status.staged_batches} batches)\n`;
    fs.appendFileSync(logPath, logEntry, 'utf8');
  }

  // 5. Optional WebSocket stream broadcast
  if (streamMode) {
    const wsPort = parseInt(process.env.ICF_WS_PORT || '8765', 10);
    const wsServer = new IcfWebSocketServer({ port: wsPort });
    try {
      await wsServer.start();
      console.log(`[ICF-WS] Streaming telemetry on ws://127.0.0.1:${wsPort}`);
      wsServer.broadcast(telemetry);
      // Allow brief moment for attached clients to receive frame
      await new Promise(r => setTimeout(r, 200));
      await wsServer.close();
    } catch (err) {
      console.warn(`[ICF-WS] WebSocket broadcast skipped: ${err.message}`);
    }
  }

  // 6. Fail-Closed Gate
  if (telemetry.vault_status.recovery_pending || telemetry.vault_status.concurrency_locked) {
    console.error('[ICF-GATE] Ingestion halted: Active recovery manifest or unresolved queue lock detected.');
    process.exit(1);
  }

  console.log('[ICF] Morning ingestion telemetry pass completed successfully.');
}

runMorningIngestion().catch((err) => {
  console.error('[ICF] Fatal ingestion error:', err);
  process.exit(1);
});
