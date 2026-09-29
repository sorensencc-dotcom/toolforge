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
const GDRIVE_OUTBOX = path.join(GDRIVE_ROOT, 'mobile-outbox');
const GDRIVE_ARCHIVE = path.join(GDRIVE_ROOT, '04_archive/mobile-inbox');

const LOCAL_INBOX_ROOT = path.resolve(process.env.TRM_DRIVE || path.join(REPO_ROOT, 'trm-drive/inbox'));
const LOCAL_INBOX_DIR = path.join(LOCAL_INBOX_ROOT, 'triage');
const LOCAL_OUTBOX_DIR = path.join(LOCAL_INBOX_ROOT, 'outbox');
const LOCAL_DOT_TRM_INBOX = path.join(REPO_ROOT, '.trm/inbox/triage');
const LOCAL_DOT_TRM_OUTBOX = path.join(REPO_ROOT, '.trm/inbox/outbox');

const COMPLETED_DIR = path.join(LOCAL_INBOX_ROOT, 'completed');
const QUARANTINE_DIR = path.join(LOCAL_INBOX_ROOT, 'quarantine');
const HARNESS_PENDING_DIR = path.resolve(path.join(REPO_ROOT, '.harness/tasks/pending'));
const LEDGER_JSONL = path.join(LOCAL_INBOX_ROOT, 'ledger.jsonl');
const LEDGER_MD = path.join(LOCAL_INBOX_ROOT, 'LEDGER.md');
const STATUS_FEED_DIR = path.resolve(path.join(REPO_ROOT, '_status-feed'));
const STATUS_FEED_JSON = path.join(STATUS_FEED_DIR, 'trm_ingress_status.json');

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isOnce = args.includes('--once') || isDryRun;
const isStatus = args.includes('--status');

// Discover all active inbox directories
export function getActiveInboxDirs() {
  const dirs = [];
  if (fs.existsSync(GDRIVE_INBOX)) dirs.push(GDRIVE_INBOX);
  if (fs.existsSync(LOCAL_INBOX_DIR)) dirs.push(LOCAL_INBOX_DIR);
  if (fs.existsSync(LOCAL_DOT_TRM_INBOX)) dirs.push(LOCAL_DOT_TRM_INBOX);
  return dirs;
}

// Discover all active mobile outbox directories
export function getActiveOutboxDirs() {
  const dirs = [];
  if (fs.existsSync(GDRIVE_ROOT)) {
    dirs.push(GDRIVE_OUTBOX);
  }
  dirs.push(LOCAL_OUTBOX_DIR);
  dirs.push(LOCAL_DOT_TRM_OUTBOX);
  return dirs;
}

// Ensure required directories exist
for (const dir of [LOCAL_INBOX_DIR, LOCAL_OUTBOX_DIR, LOCAL_DOT_TRM_INBOX, LOCAL_DOT_TRM_OUTBOX, COMPLETED_DIR, QUARANTINE_DIR, HARNESS_PENDING_DIR, STATUS_FEED_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function safeMoveFile(src, dest) {
  if (!fs.existsSync(src)) return false;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  try {
    fs.renameSync(src, dest);
    return true;
  } catch (err) {
    // Cross-volume or locked move fallback: copy + unlink
    try {
      fs.copyFileSync(src, dest);
      fs.unlinkSync(src);
      return true;
    } catch (copyErr) {
      if (src.endsWith('.gdoc')) {
        try {
          fs.writeFileSync(dest, `{"archived_gdoc": "${path.basename(src)}", "archived_at": "${new Date().toISOString()}"}`, 'utf8');
          fs.unlinkSync(src);
          return true;
        } catch {}
      }
      console.error(`[TRM-INGRESS] Failed to move ${src} -> ${dest}:`, copyErr.message);
      return false;
    }
  }
}

export function cleanupCompanionFiles(filePath, isFromGDrive) {
  try {
    const dir = path.dirname(filePath);
    const base = path.basename(filePath);
    const stem = base.replace(/\.(json|md)$/i, '');
    const dateMatch = base.match(/^(\d{4}-\d{2}-\d{2}T\d{6}Z)/);
    const datePrefix = dateMatch ? dateMatch[1] : null;

    if (!fs.existsSync(dir)) return;
    const siblings = fs.readdirSync(dir);
    for (const sib of siblings) {
      if (sib === base) continue;
      const isMatch = (sib.startsWith(stem) && sib.endsWith('.gdoc')) ||
                      (datePrefix && sib.startsWith(datePrefix) && sib.endsWith('.gdoc'));
      if (isMatch) {
        const fullSib = path.join(dir, sib);
        if (isFromGDrive && fs.existsSync(GDRIVE_ARCHIVE)) {
          safeMoveFile(fullSib, path.join(GDRIVE_ARCHIVE, sib));
        } else {
          try { fs.unlinkSync(fullSib); } catch {}
        }
      }
    }
  } catch {}
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

export function emitIcfStatusFeed(rows = null, options = {}) {
  const dryRun = options.dryRun !== undefined ? options.dryRun : isDryRun;
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
    dryRun,
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

/**
 * Dispatch structured action receipt to active mobile outbox channels.
 */
export function dispatchMobileReceipt(item, result = {}, options = {}) {
  const dryRun = options.dryRun !== undefined ? options.dryRun : isDryRun;
  const receiptId = `rcpt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const outboxes = getActiveOutboxDirs();
  const receipt = {
    receipt_id: receiptId,
    action_id: item.id || 'N/A',
    source: item.source || 'mobile',
    intent: item.intent || 'unknown',
    action_type: item.action_type || 'unknown',
    status: result.status || 'COMPLETED',
    summary: item.summary || item.context?.summary || '',
    issue_url: result.issue_url || item.issue_url || null,
    target_notebook: item.target_notebook_name || item.target_notebook || null,
    dispatched_at: new Date().toISOString(),
    duration_ms: result.duration_ms || 0,
    error: result.error || null,
    execution_details: result.details || null,
    dryRun
  };

  const safeIntent = (item.intent || 'action').replace(/[^a-zA-Z0-9_\-]/g, '_');
  const fileNameJson = `receipt-${Date.now()}-${safeIntent}.json`;
  const fileNameMd = `receipt-${Date.now()}-${safeIntent}.md`;

  const mdContent = `# Action Receipt: \`${receipt.receipt_id}\`\n\n` +
    `- **Original Action ID**: \`${receipt.action_id}\`\n` +
    `- **Status**: \`${receipt.status}\`\n` +
    `- **Intent**: \`${receipt.intent}\`\n` +
    `- **Source**: \`${receipt.source}\`\n` +
    `- **Dispatched At**: \`${receipt.dispatched_at}\`\n` +
    `- **Duration**: \`${receipt.duration_ms}ms\`\n` +
    (receipt.issue_url ? `- **Tracking Issue**: [${receipt.issue_url}](${receipt.issue_url})\n` : '') +
    (receipt.error ? `- **Error**: \`${receipt.error}\`\n` : '') +
    `\n### Summary\n${receipt.summary || 'No summary provided.'}\n`;

  if (!dryRun) {
    for (const outbox of outboxes) {
      try {
        fs.mkdirSync(outbox, { recursive: true });
        fs.writeFileSync(path.join(outbox, fileNameJson), JSON.stringify(receipt, null, 2), 'utf8');
        fs.writeFileSync(path.join(outbox, fileNameMd), mdContent, 'utf8');
      } catch (err) {
        console.warn(`[TRM-INGRESS] Could not write receipt to outbox ${outbox}: ${err.message}`);
      }
    }
  }

  return receipt;
}

export function processFile(filePath, options = {}) {
  const dryRun = options.dryRun !== undefined ? options.dryRun : isDryRun;
  if (!fs.existsSync(filePath)) return null;

  const ext = path.extname(filePath).toLowerCase();
  if (ext !== '.json' && ext !== '.md') return null;

  const filename = path.basename(filePath);
  const isFromGDrive = filePath.startsWith(path.resolve(GDRIVE_ROOT));
  console.log(`[TRM-INGRESS] Reading incoming file: ${filename} (Source: ${isFromGDrive ? 'Google Drive' : 'Local'}, Dry-Run: ${dryRun})`);
  const startTime = Date.now();

  let item;
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw.trim()) return null;
    item = parsePayload(raw, ext);
    validatePayload(item);
  } catch (err) {
    console.error(`[TRM-INGRESS] Validation failed for ${filename}: ${err.message}`);
    if (dryRun) {
      return {
        id: `invalid-${filename}`,
        source: 'unknown',
        action_type: 'unknown',
        intent: 'validation_error',
        status: 'VALIDATION_FAILED_DRY_RUN',
        error: err.message
      };
    }
    const qTarget = path.join(QUARANTINE_DIR, `${Date.now()}-${filename}`);
    const moved = safeMoveFile(filePath, qTarget);
    logToLedger({
      id: `invalid-${filename}`,
      processed_at: new Date().toISOString(),
      source: 'unknown',
      action_type: 'unknown',
      intent: 'validation_error',
      status: moved ? 'QUARANTINED' : 'QUARANTINE_MOVE_FAILED',
      error: err.message,
      duration_ms: Date.now() - startTime
    });
    return null;
  }

  const itemId = item.id || `act-${Date.now()}`;
  console.log(`[TRM-INGRESS] Dispatching action: ${itemId} | Type: ${item.action_type} | Intent: ${item.intent}`);

  if (dryRun) {
    console.log(`[TRM-INGRESS] [DRY-RUN] Inspected card ${itemId} (${item.action_type}) without mutating inbox or ledger.`);
    return {
      id: itemId,
      source: item.source,
      action_type: item.action_type,
      intent: item.intent,
      status: 'INSPECTED_DRY_RUN'
    };
  }

  try {
    if (item.action_type === 'deterministic_fix') {
      // Option B: Automated Iron Bot Remediation
      executeDeterministicFix(item);
      
      const dest = path.join(COMPLETED_DIR, `${Date.now()}-${filename}`);
      let archived = false;

      try {
        fs.copyFileSync(filePath, dest);
      } catch (copyErr) {
        console.error(`[TRM-INGRESS] Failed to copy to completed archive:`, copyErr.message);
      }
      
      // If from Google Drive, archive to GDrive archive or remove from local inbox
      if (isFromGDrive && fs.existsSync(GDRIVE_ARCHIVE)) {
        archived = safeMoveFile(filePath, path.join(GDRIVE_ARCHIVE, filename));
      } else if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          archived = true;
        } catch (unlinkErr) {
          console.error(`[TRM-INGRESS] Failed to unlink source card:`, unlinkErr.message);
          archived = false;
        }
      }
      
      if (archived) {
        cleanupCompanionFiles(filePath, isFromGDrive);
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
        dispatchMobileReceipt(item, {
          status: 'RESOLVED',
          duration_ms: Date.now() - startTime,
          details: 'Executed deterministic remediation and archived card'
        });
      } else {
        console.warn(`[TRM-INGRESS] ⚠️ Action executed but failed to archive source card from inbox: ${filePath}`);
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
          status: 'ARCHIVE_MOVE_FAILED',
          error: 'Action executed but card could not be archived/removed from inbox',
          duration_ms: Date.now() - startTime
        });
      }
    } else if (item.action_type === 'antigravity_triage') {
      // Option A: Auto-create GitHub Issue for tracking/approval + Stage to Harness
      const issueUrl = createGitHubIssue(item);
      item.issue_url = issueUrl;

      const dest = path.join(HARNESS_PENDING_DIR, filename);
      fs.writeFileSync(dest, JSON.stringify(item, null, 2), 'utf8');
      
      let archived = false;
      if (isFromGDrive && fs.existsSync(GDRIVE_ARCHIVE)) {
        archived = safeMoveFile(filePath, path.join(GDRIVE_ARCHIVE, filename));
      } else if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          archived = true;
        } catch (unlinkErr) {
          console.error(`[TRM-INGRESS] Failed to unlink source card:`, unlinkErr.message);
          archived = false;
        }
      }
      
      if (archived) {
        cleanupCompanionFiles(filePath, isFromGDrive);
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
        dispatchMobileReceipt(item, {
          status: 'STAGED_FOR_TRIAGE',
          issue_url: issueUrl,
          duration_ms: Date.now() - startTime,
          details: `Staged to .harness/tasks/pending/${filename}`
        });
      } else {
        console.warn(`[TRM-INGRESS] ⚠️ Staged to harness but failed to archive source card from inbox: ${filePath}`);
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
          status: 'STAGED_ARCHIVE_FAILED',
          error: 'Staged to harness but card could not be archived/removed from inbox',
          duration_ms: Date.now() - startTime
        });
      }
    }
  } catch (execErr) {
    console.error(`[TRM-INGRESS] Execution failed for ${itemId}:`, execErr);
    let quarantined = false;
    if (fs.existsSync(filePath)) {
      const qTarget = path.join(QUARANTINE_DIR, `failed-${Date.now()}-${filename}`);
      quarantined = safeMoveFile(filePath, qTarget);
    }
    logToLedger({
      id: itemId,
      processed_at: new Date().toISOString(),
      timestamp: item.timestamp,
      source: item.source,
      action_type: item.action_type,
      intent: item.intent,
      status: quarantined ? 'QUARANTINED' : 'QUARANTINE_MOVE_FAILED',
      error: execErr.message,
      duration_ms: Date.now() - startTime
    });
    dispatchMobileReceipt(item, {
      status: quarantined ? 'QUARANTINED' : 'QUARANTINE_MOVE_FAILED',
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

export function parseGDocFilenameMetadata(filename) {
  const stem = filename.replace(/\.(md\.)?gdoc$/i, '');
  const parts = stem.split('__');
  
  let timestamp = new Date().toISOString();
  let action_type = 'antigravity_triage';
  let id = stem;
  let intent = stem;

  if (parts.length >= 3) {
    timestamp = parts[0];
    action_type = parts[1] === 'action' ? 'antigravity_triage' : parts[1];
    id = parts[2];
    intent = parts.slice(2).join('__');
  } else if (parts.length === 2) {
    timestamp = parts[0];
    id = parts[1];
    intent = parts[1];
  }

  const cleanIntent = intent.replace(/^act-\d+-/, '').replace(/-/g, '_');

  return {
    id,
    timestamp,
    source: 'mobile-gemini-gdoc',
    action_type: action_type === 'deterministic_fix' ? 'deterministic_fix' : 'antigravity_triage',
    intent: cleanIntent,
    summary: `Mobile action item submitted via Google Docs: ${stem}`,
    context: {
      gdoc_filename: filename,
      gdoc_stem: stem,
      note: 'Ingested from standalone Google Drive .gdoc pointer. Payload body managed via triage issue.'
    }
  };
}

export function processGDocStub(filePath, inboxDir, options = {}) {
  const dryRun = options.dryRun !== undefined ? options.dryRun : isDryRun;
  if (!fs.existsSync(filePath)) return null;

  const startTime = Date.now();
  const filename = path.basename(filePath);
  const isFromGDrive = filePath.startsWith(path.resolve(GDRIVE_ROOT));
  const stem = filename.replace(/\.(md\.)?gdoc$/i, '');
  const dateMatch = filename.match(/^(\d{4}-\d{2}-\d{2}T\d{6}Z)/);
  const datePrefix = dateMatch ? dateMatch[1] : null;

  // Check if this stub matches any already-tracked ledger row, harness task, or archive file
  let isAlreadyHandled = false;
  if (fs.existsSync(LEDGER_JSONL)) {
    try {
      const lines = fs.readFileSync(LEDGER_JSONL, 'utf8').split('\n').filter(Boolean);
      for (const line of lines) {
        const entry = JSON.parse(line);
        if ((datePrefix && entry.timestamp && entry.timestamp.replace(/[:-]/g, '').startsWith(datePrefix.replace(/[:-]/g, ''))) ||
            (entry.id && filename.includes(entry.id)) ||
            (entry.intent && filename.includes(entry.intent)) ||
            (stem && entry.id && stem.includes(entry.id))) {
          isAlreadyHandled = true;
          break;
        }
      }
    } catch {}
  }

  if (!isAlreadyHandled && isFromGDrive && fs.existsSync(GDRIVE_ARCHIVE)) {
    try {
      const archivedFiles = fs.readdirSync(GDRIVE_ARCHIVE);
      for (const af of archivedFiles) {
        if ((datePrefix && af.startsWith(datePrefix)) || (stem && af.includes(stem))) {
          isAlreadyHandled = true;
          break;
        }
      }
    } catch {}
  }

  if (isAlreadyHandled) {
    if (dryRun) {
      console.log(`[TRM-INGRESS] [DRY-RUN] Found orphaned .gdoc pointer matching handled action: ${filename}`);
      return { id: filename, status: 'MATCHED_HANDLED_GDOC_DRY_RUN' };
    }

    const dest = isFromGDrive && fs.existsSync(GDRIVE_ARCHIVE)
      ? path.join(GDRIVE_ARCHIVE, filename)
      : path.join(COMPLETED_DIR, filename);

    const moved = safeMoveFile(filePath, dest);
    console.log(`[TRM-INGRESS] Archived handled .gdoc stub: ${filename} (moved: ${moved})`);
    return { id: filename, status: moved ? 'ARCHIVED_HANDLED_GDOC' : 'ARCHIVE_MOVE_FAILED' };
  }

  // Handle standalone unhandled .gdoc
  const item = parseGDocFilenameMetadata(filename);
  console.log(`[TRM-INGRESS] Ingesting standalone .gdoc card: ${item.id} | Intent: ${item.intent} (Dry-Run: ${dryRun})`);

  if (dryRun) {
    return { id: item.id, status: 'STAGED_STANDALONE_GDOC_DRY_RUN' };
  }

  const issueUrl = createGitHubIssue(item);
  const harnessTask = {
    id: item.id,
    timestamp: item.timestamp,
    source: item.source,
    action_type: item.action_type,
    intent: item.intent,
    summary: item.summary,
    issue_url: issueUrl,
    staged_at: new Date().toISOString(),
    source_file: filename,
    context: item.context
  };

  const harnessDest = path.join(HARNESS_PENDING_DIR, `${item.id}.json`);
  fs.writeFileSync(harnessDest, JSON.stringify(harnessTask, null, 2), 'utf8');

  const dest = isFromGDrive && fs.existsSync(GDRIVE_ARCHIVE)
    ? path.join(GDRIVE_ARCHIVE, filename)
    : path.join(COMPLETED_DIR, filename);

  const moved = safeMoveFile(filePath, dest);

  logToLedger({
    id: item.id,
    processed_at: new Date().toISOString(),
    timestamp: item.timestamp,
    source: item.source,
    action_type: item.action_type,
    intent: item.intent,
    status: 'STAGED_FOR_TRIAGE',
    issue_url: issueUrl,
    duration_ms: Date.now() - startTime
  });

  dispatchMobileReceipt(item, {
    status: 'STAGED_FOR_TRIAGE',
    issue_url: issueUrl,
    duration_ms: Date.now() - startTime,
    details: `Staged standalone .gdoc to .harness/tasks/pending/${item.id}.json`
  }, { dryRun });

  return { id: item.id, status: 'STAGED_STANDALONE_GDOC', moved };
}

export function sweepInbox(options = {}) {
  const dryRun = options.dryRun !== undefined ? options.dryRun : isDryRun;
  const inboxes = getActiveInboxDirs();
  const inspectedCards = [];
  for (const inbox of inboxes) {
    try {
      const files = fs.readdirSync(inbox);
      for (const file of files) {
        const full = path.join(inbox, file);
        try {
          if (fs.statSync(full).isFile()) {
            if (file.endsWith('.gdoc')) {
              const gdocRes = processGDocStub(full, inbox, { dryRun });
              if (gdocRes) inspectedCards.push(gdocRes);
              continue;
            }
            const res = processFile(full, { dryRun });
            if (res) inspectedCards.push(res);
          }
        } catch (e) {
          // Skip temporary/locked files
        }
      }
    } catch {}
  }
  emitIcfStatusFeed(null, { dryRun });
  return { inspectedCards, inboxesChecked: inboxes.length };
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
  if (isStatus) {
    printStatus();
    process.exit(0);
  }

  console.log(`[TRM-INGRESS] Starting Ingress Watcher on ${getActiveInboxDirs().length} active inboxes... (dry-run: ${isDryRun}, once: ${isOnce})`);
  sweepInbox({ dryRun: isDryRun });

  if (!isOnce && !isDryRun) {
    console.log(`[TRM-INGRESS] Watching for incoming action items (Ctrl+C to stop)...`);
    for (const inboxDir of getActiveInboxDirs()) {
      fs.watch(inboxDir, (eventType, filename) => {
        if (filename && (eventType === 'rename' || eventType === 'change')) {
          const fullPath = path.join(inboxDir, filename);
          if (fs.existsSync(fullPath)) {
            setTimeout(() => {
              if (fs.existsSync(fullPath)) {
                if (filename.endsWith('.gdoc')) {
                  processGDocStub(fullPath, inboxDir, { dryRun: isDryRun });
                } else {
                  processFile(fullPath, { dryRun: isDryRun });
                }
              }
            }, 300);
          }
        }
      });
    }
  }
}
