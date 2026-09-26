import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execSync } from 'node:child_process';

/**
 * scripts/trm-ingress-watcher.mjs
 *
 * Watches TRM Ingress staging inboxes:
 * - Canonical Google Drive: G:\My Drive\TRM-Research\mobile-inbox (or process.env.TRM_DRIVE)
 * - Local dev inboxes: c:\dev\trm-drive\inbox\triage, c:\dev\.trm\inbox\triage
 *
 * Routes actions to:
 * 1. Iron Bots (deterministic_fix) -> auto-remediates & archives to completed/
 * 2. Antigravity / Claude Code (antigravity_triage) -> auto-creates GitHub Issue with context,
 *    logs issue URL to ledger, and stages to .harness/tasks/pending/.
 * Feeds live telemetry to Iron Command Forge (_status-feed/trm_ingress_status.json).
 */

const REPO_ROOT = path.resolve('c:/dev');
const GDRIVE_ROOT = 'G:/My Drive/TRM-Research';
const GDRIVE_INBOX = path.join(GDRIVE_ROOT, 'mobile-inbox');
const GDRIVE_ARCHIVE = path.join(GDRIVE_ROOT, '04_archive/mobile-inbox');

const LOCAL_INBOX_ROOT = path.resolve(process.env.TRM_DRIVE || path.join(REPO_ROOT, 'trm-drive/inbox'));
const LOCAL_INBOX_DIR = path.join(LOCAL_INBOX_ROOT, 'triage');
const LOCAL_DOT_TRM_INBOX = path.join(REPO_ROOT, '.trm/inbox/triage');

const COMPLETED_DIR = path.join(LOCAL_INBOX_ROOT, 'completed');
const QUARANTINE_DIR = path.join(LOCAL_INBOX_ROOT, 'quarantine');
const HARNESS_PENDING_DIR = path.resolve(path.join(REPO_ROOT, '.harness/tasks/pending'));
const LEDGER_JSONL = path.join(LOCAL_INBOX_ROOT, 'ledger.jsonl');
const LEDGER_MD = path.join(LOCAL_INBOX_ROOT, 'LEDGER.md');
const STATUS_FEED_DIR = path.resolve(path.join(REPO_ROOT, '_status-feed'));
const STATUS_FEED_JSON = path.join(STATUS_FEED_DIR, 'trm_ingress_status.json');

// Discover all active inbox directories
export function getActiveInboxDirs() {
  const dirs = [];
  if (fs.existsSync(GDRIVE_INBOX)) dirs.push(GDRIVE_INBOX);
  if (fs.existsSync(LOCAL_INBOX_DIR)) dirs.push(LOCAL_INBOX_DIR);
  if (fs.existsSync(LOCAL_DOT_TRM_INBOX)) dirs.push(LOCAL_DOT_TRM_INBOX);
  return dirs;
}

// Ensure required directories exist
for (const dir of [LOCAL_INBOX_DIR, LOCAL_DOT_TRM_INBOX, COMPLETED_DIR, QUARANTINE_DIR, HARNESS_PENDING_DIR, STATUS_FEED_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function parsePayload(raw, ext) {
  if (ext === '.json') {
    return JSON.parse(raw);
  }
  if (ext === '.md') {
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) {
      throw new Error('Markdown action item missing frontmatter block');
    }
    const lines = match[1].split(/\r?\n/);
    const frontmatter = {};
    for (const line of lines) {
      const idx = line.indexOf(':');
      if (idx > 0) {
        const key = line.slice(0, idx).trim();
        const val = line.slice(idx + 1).trim();
        frontmatter[key] = val;
      }
    }
    const body = raw.slice(match[0].length).trim();
    return {
      ...frontmatter,
      context: {
        ...(frontmatter.context ? (typeof frontmatter.context === 'string' ? JSON.parse(frontmatter.context) : frontmatter.context) : {}),
        body
      }
    };
  }
  throw new Error(`Unsupported file extension: ${ext}`);
}

export function validatePayload(item) {
  if (!item.source) throw new Error('Missing source');
  if (!item.action_type || !['deterministic_fix', 'antigravity_triage'].includes(item.action_type)) {
    throw new Error(`Invalid or missing action_type: ${item.action_type}`);
  }
  if (!item.intent) throw new Error('Missing intent');
  return true;
}

export function createGitHubIssue(item) {
  try {
    const priority = (item.priority || 'P2').toUpperCase();
    const title = `[TRM-Triage] [${priority}] ${item.intent}: ${item.summary || item.id}`;

    let body = `## TRM Mobile Action Item: \`${item.id || 'N/A'}\`\n\n`;
    body += `- **Source**: \`${item.source || 'mobile-gemini'}\`\n`;
    body += `- **Intent**: \`${item.intent}\`\n`;
    body += `- **Priority**: \`${priority}\`\n`;
    body += `- **Target**: \`${item.target_notebook_name || item.target_notebook || 'N/A'}\`\n`;
    body += `- **Ingress Timestamp**: \`${item.timestamp || new Date().toISOString()}\`\n\n`;

    body += `### Summary\n${item.summary || item.context?.summary || 'No summary provided.'}\n\n`;

    if (item.context?.error) {
      body += `### Error / Diagnostic Trace\n\`\`\`\n${item.context.error}\n\`\`\`\n\n`;
    }

    if (item.execution_plan && Array.isArray(item.execution_plan)) {
      body += `### Proposed Execution Plan\n`;
      for (const p of item.execution_plan) {
        body += `- Step ${p.step || ''}: [${p.handler || 'bot'}] \`${p.action || ''}\` ${p.command ? `(\`${p.command}\`)` : ''}\n`;
      }
      body += `\n`;
    }

    body += `<details>\n<summary>Raw Ingress Action Payload</summary>\n\n\`\`\`json\n`;
    body += JSON.stringify(item, null, 2);
    body += `\n\`\`\`\n</details>\n`;

    const tmpPath = path.join(os.tmpdir(), `trm-issue-${Date.now()}.md`);
    fs.writeFileSync(tmpPath, body, 'utf8');

    console.log(`[TRM-INGRESS] Creating GitHub Issue via gh CLI...`);
    const output = execSync(`gh issue create --title "${title.replace(/"/g, '\\"')}" --body-file "${tmpPath}"`, {
      cwd: REPO_ROOT,
      encoding: 'utf8'
    });

    try { fs.unlinkSync(tmpPath); } catch {}
    const issueUrl = output.trim().split(/\r?\n/).pop();
    console.log(`[TRM-INGRESS] GitHub Issue created: ${issueUrl}`);
    return issueUrl;
  } catch (err) {
    console.warn(`[TRM-INGRESS] Could not create GitHub Issue automatically: ${err.message}`);
    return null;
  }
}

export function logToLedger(entry) {
  const line = JSON.stringify(entry) + '\n';
  fs.appendFileSync(LEDGER_JSONL, line, 'utf8');
  refreshLedgerMarkdown();
}

export function refreshLedgerMarkdown() {
  if (!fs.existsSync(LEDGER_JSONL)) return;
  const lines = fs.readFileSync(LEDGER_JSONL, 'utf8').trim().split('\n').filter(Boolean);
  const rows = lines.map((l) => {
    try {
      return JSON.parse(l);
    } catch {
      return null;
    }
  }).filter(Boolean);

  let md = `# TRM Action Card Tracking Ledger\n\n`;
  md += `*Updated: ${new Date().toISOString()} | Total Tracked: ${rows.length}*\n\n`;
  md += `| Processed At | Card ID | Source | Action Type | Intent | Target | Status | Tracking / Issue |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

  // Display newest first
  for (const r of rows.slice().reverse()) {
    const statusIcon = r.status === 'COMPLETED' ? '✅ COMPLETED' : r.status === 'STAGED_FOR_TRIAGE' ? '⏳ STAGED' : '❌ QUARANTINED';
    const target = r.target_notebook_name || r.target_notebook || 'N/A';
    const issueLink = r.issue_url ? `[Issue #${r.issue_url.split('/').pop()}](${r.issue_url})` : '—';
    md += `| ${r.processed_at || r.timestamp || 'N/A'} | \`${r.id || 'N/A'}\` | ${r.source || 'N/A'} | \`${r.action_type || 'N/A'}\` | \`${r.intent || 'N/A'}\` | ${target} | ${statusIcon} | ${issueLink} |\n`;
  }

  md += `\n---\n\n### Monitored Ingress Inboxes\n`;
  if (fs.existsSync(GDRIVE_INBOX)) md += `- **Google Drive Ingress**: \`${GDRIVE_INBOX}\` (Folder ID: \`1Faya0q0j3S62NGq_U-nxrefwbwfGQq0g\`)\n`;
  md += `- **Local Triage Ingress**: \`${LOCAL_INBOX_DIR}\`\n`;
  md += `- **Completed Archive**: \`${COMPLETED_DIR}\`\n`;
  md += `- **Antigravity Pending**: \`${HARNESS_PENDING_DIR}\`\n`;

  fs.writeFileSync(LEDGER_MD, md, 'utf8');

  // Emit ICF Status Feed artifact
  emitIcfStatusFeed(rows);
}

export function emitIcfStatusFeed(rows = null) {
  if (!rows && fs.existsSync(LEDGER_JSONL)) {
    const lines = fs.readFileSync(LEDGER_JSONL, 'utf8').trim().split('\n').filter(Boolean);
    rows = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  }
  rows = rows || [];

  let triageCount = 0;
  for (const dir of getActiveInboxDirs()) {
    try { triageCount += fs.readdirSync(dir).length; } catch {}
  }
  const completedCount = fs.existsSync(COMPLETED_DIR) ? fs.readdirSync(COMPLETED_DIR).length : 0;
  const quarantinedCount = fs.existsSync(QUARANTINE_DIR) ? fs.readdirSync(QUARANTINE_DIR).length : 0;
  const harnessPendingCount = fs.existsSync(HARNESS_PENDING_DIR) ? fs.readdirSync(HARNESS_PENDING_DIR).length : 0;

  const telemetry = {
    timestamp: new Date().toISOString(),
    status: quarantinedCount > 0 ? 'ATTENTION' : 'HEALTHY',
    triageQueue: triageCount,
    completed: completedCount,
    quarantined: quarantinedCount,
    harnessPending: harnessPendingCount,
    totalTracked: rows.length,
    activeInboxes: getActiveInboxDirs(),
    recentCards: rows.slice(-10).reverse()
  };

  fs.writeFileSync(STATUS_FEED_JSON, JSON.stringify(telemetry, null, 2), 'utf8');
}

export function processFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext !== '.json' && ext !== '.md') return;

  const filename = path.basename(filePath);
  const isFromGDrive = filePath.startsWith(path.resolve(GDRIVE_ROOT));
  console.log(`[TRM-INGRESS] Reading incoming file: ${filename} (Source: ${isFromGDrive ? 'Google Drive' : 'Local'})`);
  const startTime = Date.now();

  let item;
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw.trim()) return;
    item = parsePayload(raw, ext);
    validatePayload(item);
  } catch (err) {
    console.error(`[TRM-INGRESS] Validation failed for ${filename}: ${err.message}`);
    const qTarget = path.join(QUARANTINE_DIR, `${Date.now()}-${filename}`);
    fs.renameSync(filePath, qTarget);
    logToLedger({
      id: `invalid-${filename}`,
      processed_at: new Date().toISOString(),
      source: 'unknown',
      action_type: 'unknown',
      intent: 'validation_error',
      status: 'QUARANTINED',
      error: err.message,
      duration_ms: Date.now() - startTime
    });
    return;
  }

  const itemId = item.id || `act-${Date.now()}`;
  console.log(`[TRM-INGRESS] Dispatching action: ${itemId} | Type: ${item.action_type} | Intent: ${item.intent}`);

  try {
    if (item.action_type === 'deterministic_fix') {
      // Option B: Automated Iron Bot Remediation
      executeDeterministicFix(item);
      
      const dest = path.join(COMPLETED_DIR, `${Date.now()}-${filename}`);
      fs.copyFileSync(filePath, dest);
      
      // If from Google Drive, archive to GDrive archive or remove from mobile inbox
      if (isFromGDrive && fs.existsSync(GDRIVE_ARCHIVE)) {
        fs.renameSync(filePath, path.join(GDRIVE_ARCHIVE, filename));
      } else {
        fs.unlinkSync(filePath);
      }
      
      console.log(`[TRM-INGRESS] Successfully executed and archived: ${dest}`);
      logToLedger({
        id: itemId,
        processed_at: new Date().toISOString(),
        timestamp: item.timestamp,
        source: item.source,
        action_type: item.action_type,
        intent: item.intent,
        target_notebook: item.target_notebook,
        target_notebook_name: item.target_notebook_name,
        summary: item.summary || item.context?.summary || '',
        status: 'COMPLETED',
        duration_ms: Date.now() - startTime
      });
    } else if (item.action_type === 'antigravity_triage') {
      // Option A: Auto-create GitHub Issue for tracking/approval + Stage to Harness
      const issueUrl = createGitHubIssue(item);
      item.issue_url = issueUrl;

      const dest = path.join(HARNESS_PENDING_DIR, filename);
      fs.writeFileSync(dest, JSON.stringify(item, null, 2), 'utf8');
      
      if (isFromGDrive && fs.existsSync(GDRIVE_ARCHIVE)) {
        fs.renameSync(filePath, path.join(GDRIVE_ARCHIVE, filename));
      } else if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      
      console.log(`[TRM-INGRESS] Staged for Antigravity triage: ${dest}`);
      logToLedger({
        id: itemId,
        processed_at: new Date().toISOString(),
        timestamp: item.timestamp,
        source: item.source,
        action_type: item.action_type,
        intent: item.intent,
        target_notebook: item.target_notebook,
        target_notebook_name: item.target_notebook_name,
        summary: item.summary || item.context?.summary || '',
        issue_url: issueUrl,
        status: 'STAGED_FOR_TRIAGE',
        duration_ms: Date.now() - startTime
      });
    }
  } catch (execErr) {
    console.error(`[TRM-INGRESS] Execution failed for ${itemId}:`, execErr);
    const qTarget = path.join(QUARANTINE_DIR, `failed-${Date.now()}-${filename}`);
    fs.renameSync(filePath, qTarget);
    logToLedger({
      id: itemId,
      processed_at: new Date().toISOString(),
      timestamp: item.timestamp,
      source: item.source,
      action_type: item.action_type,
      intent: item.intent,
      status: 'QUARANTINED',
      error: execErr.message,
      duration_ms: Date.now() - startTime
    });
  }
}

function executeDeterministicFix(item) {
  console.log(`[IronBot] Executing deterministic fix for intent: ${item.intent}`);

  // 1. Batch delete failed/dead sources if specified in execution plan or context
  const deletePlan = Array.isArray(item.execution_plan) ? item.execution_plan.find(p => p.action === 'batch_delete_sources') : null;
  const targetIds = deletePlan?.target_ids || item.context?.failed_sources?.map(s => typeof s === 'string' ? s : (s.name ? s.name.split('/').pop() : s.id)).filter(Boolean) || [];

  if (targetIds.length > 0) {
    try {
      console.log(`[IronBot] Pruning ${targetIds.length} failed sources from NotebookLM via nlm CLI...`);
      execSync(`nlm source delete ${targetIds.join(' ')} --confirm`, {
        cwd: REPO_ROOT,
        stdio: 'inherit'
      });
      console.log(`[IronBot] Successfully pruned ${targetIds.length} failed sources.`);
    } catch (nlmErr) {
      console.warn(`[IronBot] nlm source delete warning: ${nlmErr.message}`);
    }
  }

  // 2. Consolidate knowledge packs
  if (item.intent === 'remediate_quarantine_enobufs' || item.intent === 'consolidate_pack') {
    const maxBudget = item.context?.parameters?.budget_rule || item.context?.budget_rule || '380k';
    const cleanBudget = maxBudget.replace(/[^0-9a-zA-Z]/g, '');
    const scriptPath = path.join(REPO_ROOT, 'scripts/consolidate-pack.mjs');
    if (fs.existsSync(scriptPath)) {
      console.log(`[IronBot] Running consolidate-pack.mjs with budget ${cleanBudget}...`);
      execSync(`node "${scriptPath}" --max-size ${cleanBudget}`, {
        cwd: REPO_ROOT,
        stdio: 'inherit'
      });
    } else {
      console.warn(`[IronBot] consolidate-pack.mjs not found at ${scriptPath}`);
    }
  } else if (item.intent === 'prune_dead_sources' || item.intent === 'nlm_prune') {
    const scriptPath = path.join(REPO_ROOT, 'scripts/cleanup-nlm-duplicates.mjs');
    if (fs.existsSync(scriptPath)) {
      console.log(`[IronBot] Running cleanup-nlm-duplicates.mjs...`);
      execSync(`node "${scriptPath}"`, {
        cwd: REPO_ROOT,
        stdio: 'inherit'
      });
    }
  } else {
    console.log(`[IronBot] Generic deterministic fix registered for intent '${item.intent}'. No external runner invoked.`);
  }
}

export function sweepInbox() {
  const inboxes = getActiveInboxDirs();
  for (const inbox of inboxes) {
    try {
      const files = fs.readdirSync(inbox);
      for (const file of files) {
        const full = path.join(inbox, file);
        try {
          if (fs.statSync(full).isFile()) {
            processFile(full);
          }
        } catch (e) {
          // Skip temporary/locked files
        }
      }
    } catch {}
  }
  emitIcfStatusFeed();
}

export function printStatus() {
  console.log(`\n======================================================`);
  console.log(`TRM ACTION CARD INGRESS STATUS`);
  console.log(`======================================================`);
  const inboxes = getActiveInboxDirs();
  for (const ib of inboxes) {
    const count = fs.existsSync(ib) ? fs.readdirSync(ib).length : 0;
    console.log(`Inbox (${path.basename(path.dirname(ib))}/${path.basename(ib)}): ${count} files -> ${ib}`);
  }
  console.log(`Completed Archive: ${fs.existsSync(COMPLETED_DIR) ? fs.readdirSync(COMPLETED_DIR).length : 0} files`);
  console.log(`Quarantined:       ${fs.existsSync(QUARANTINE_DIR) ? fs.readdirSync(QUARANTINE_DIR).length : 0} files`);
  console.log(`Harness Pending:   ${fs.existsSync(HARNESS_PENDING_DIR) ? fs.readdirSync(HARNESS_PENDING_DIR).length : 0} files`);
  
  if (fs.existsSync(LEDGER_JSONL)) {
    const lines = fs.readFileSync(LEDGER_JSONL, 'utf8').trim().split('\n').filter(Boolean);
    console.log(`Total Tracked:     ${lines.length} items`);
    console.log(`Ledger Path:       ${LEDGER_MD}`);
    console.log(`ICF Feed Path:     ${STATUS_FEED_JSON}`);
  }
  console.log(`======================================================\n`);
  emitIcfStatusFeed();
}

// CLI Execution
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))) {
  if (process.argv.includes('--status')) {
    printStatus();
    process.exit(0);
  }

  const isOnce = process.argv.includes('--once');
  console.log(`[TRM-INGRESS] Starting Ingress Watcher on ${getActiveInboxDirs().length} active inboxes...`);
  sweepInbox();

  if (!isOnce) {
    console.log(`[TRM-INGRESS] Watching for incoming action items (Ctrl+C to stop)...`);
    for (const inboxDir of getActiveInboxDirs()) {
      fs.watch(inboxDir, (eventType, filename) => {
        if (filename && (eventType === 'rename' || eventType === 'change')) {
          const fullPath = path.join(inboxDir, filename);
          if (fs.existsSync(fullPath)) {
            setTimeout(() => {
              if (fs.existsSync(fullPath)) {
                processFile(fullPath);
              }
            }, 300);
          }
        }
      });
    }
  }
}
