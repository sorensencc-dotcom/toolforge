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
const GDRIVE_REJECTED = path.join(GDRIVE_ROOT, '04_archive/rejected');

const LOCAL_INBOX_ROOT = path.resolve(process.env.TRM_DRIVE || path.join(REPO_ROOT, 'trm-drive/inbox'));
const LOCAL_INBOX_DIR = path.join(LOCAL_INBOX_ROOT, 'triage');
const LOCAL_OUTBOX_DIR = path.join(LOCAL_INBOX_ROOT, 'outbox');
const LOCAL_REJECTED_DIR = path.join(LOCAL_INBOX_ROOT, 'rejected');
const LOCAL_DOT_TRM_INBOX = path.join(REPO_ROOT, '.trm/inbox/triage');
const LOCAL_DOT_TRM_OUTBOX = path.join(REPO_ROOT, '.trm/inbox/outbox');

const COMPLETED_DIR = path.join(LOCAL_INBOX_ROOT, 'completed');
const QUARANTINE_DIR = path.join(LOCAL_INBOX_ROOT, 'quarantine');
const HARNESS_PENDING_DIR = path.resolve(path.join(REPO_ROOT, '.harness/tasks/pending'));
const HARNESS_IN_PROGRESS_DIR = path.resolve(path.join(REPO_ROOT, '.harness/tasks/in-progress'));
const HARNESS_COMPLETED_DIR = path.resolve(path.join(REPO_ROOT, '.harness/tasks/completed'));
const LEDGER_JSONL = path.join(LOCAL_INBOX_ROOT, 'ledger.jsonl');
const LEDGER_MD = path.join(LOCAL_INBOX_ROOT, 'LEDGER.md');
const STATUS_FEED_DIR = path.resolve(path.join(REPO_ROOT, '_status-feed'));
const STATUS_FEED_JSON = path.join(STATUS_FEED_DIR, 'trm_ingress_status.json');
const GDRIVE_OUTBOX_ARCHIVE = path.join(GDRIVE_ROOT, '04_archive/mobile-outbox');
const LOCAL_OUTBOX_ARCHIVE = path.join(LOCAL_INBOX_ROOT, 'completed/outbox');
const LOCAL_DOT_TRM_OUTBOX_ARCHIVE = path.join(REPO_ROOT, '.trm/inbox/outbox/archive');

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isOnce = args.includes('--once') || isDryRun;
const isStatus = args.includes('--status');
const isSyncReceipts = args.includes('--sync-receipts');
const isSweepOutbox = args.includes('--sweep-outbox');

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

// Discover all active mobile outbox archive directories
export function getActiveOutboxArchiveDirs() {
  const dirs = [];
  if (fs.existsSync(GDRIVE_ROOT)) {
    dirs.push(GDRIVE_OUTBOX_ARCHIVE);
  }
  dirs.push(LOCAL_OUTBOX_ARCHIVE);
  dirs.push(LOCAL_DOT_TRM_OUTBOX_ARCHIVE);
  return dirs;
}

// Ensure required directories exist
for (const dir of [LOCAL_INBOX_DIR, LOCAL_OUTBOX_DIR, LOCAL_REJECTED_DIR, LOCAL_DOT_TRM_INBOX, LOCAL_DOT_TRM_OUTBOX, COMPLETED_DIR, QUARANTINE_DIR, HARNESS_PENDING_DIR, HARNESS_IN_PROGRESS_DIR, HARNESS_COMPLETED_DIR, STATUS_FEED_DIR, LOCAL_OUTBOX_ARCHIVE, LOCAL_DOT_TRM_OUTBOX_ARCHIVE]) {
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

export const TARGET_ROUTING_MAP = {
  'toolforge': {
    type: 'github',
    repo: 'sorensencc-dotcom/toolforge',
    name: 'toolforge'
  },
  'rewrite': {
    type: 'github',
    repo: 'sorensencc-dotcom/rewrite-mcp',
    name: 'rewrite-mcp'
  },
  'rewrite-mcp': {
    type: 'github',
    repo: 'sorensencc-dotcom/rewrite-mcp',
    name: 'rewrite-mcp'
  },
  'sigil': {
    type: 'github',
    repo: 'sorensencc-dotcom/sigil',
    name: 'sigil'
  },
  'cic': {
    type: 'local_research',
    backlogDir: 'wiki/research',
    gdriveGaps: '01_actionable_gaps',
    name: 'CIC Research Backlog'
  },
  'cic-kb': {
    type: 'local_research',
    backlogDir: 'wiki/research',
    gdriveGaps: '01_actionable_gaps',
    name: 'CIC-KB'
  },
  'research': {
    type: 'local_research',
    backlogDir: 'wiki/research',
    gdriveGaps: '01_actionable_gaps',
    name: 'TRM Research Backlog'
  },
  'sandboxes': {
    type: 'local_research',
    backlogDir: 'wiki/research',
    name: 'Sandboxes & Security'
  },
  'cross-fleet': {
    type: 'local_research',
    backlogDir: 'wiki/research',
    name: 'Cross-Fleet / Sandboxes'
  }
};

export function resolveTargetRouting(targetName) {
  if (!targetName) return null;
  const key = String(targetName).trim().toLowerCase().replace(/^target-/, '');
  if (TARGET_ROUTING_MAP[key]) return TARGET_ROUTING_MAP[key];
  if (key.includes('toolforge')) return TARGET_ROUTING_MAP['toolforge'];
  if (key.includes('rewrite')) return TARGET_ROUTING_MAP['rewrite'];
  if (key.includes('sigil')) return TARGET_ROUTING_MAP['sigil'];
  if (key.includes('cic')) return TARGET_ROUTING_MAP['cic'];
  if (key.includes('research')) return TARGET_ROUTING_MAP['research'];
  if (key.includes('sandbox')) return TARGET_ROUTING_MAP['sandboxes'];
  if (key.includes('/')) return { type: 'github', repo: targetName, name: targetName };
  return null;
}

export function inferCategory(item) {
  if (item.category) {
    return String(item.category).toUpperCase();
  }
  const text = `${item.id || ''} ${item.intent || ''} ${item.summary || ''} ${item.action_type || ''}`.toLowerCase();
  if (text.startsWith('monitor_') || text.includes('monitor') || text.includes('frontier_lab') || text.includes('watch') || text.includes('dissent')) {
    return 'MONITOR';
  }
  if (text.startsWith('evaluate_') || text.includes('evaluate') || text.includes('audit_agent') || text.includes('assessment')) {
    return 'EVALUATE';
  }
  if (text.startsWith('research_') || text.includes('research') || text.includes('actuator') || text.includes('willow_run') || text.includes('historical')) {
    return 'RESEARCH';
  }
  if (text.startsWith('fix_') || text.includes('remediate') || text.includes('prune') || text.includes('consolidate') || text.includes('pr45') || text.includes('devin') || text.includes('gate') || text.includes('feature') || text.includes('bug') || text.includes('implement')) {
    return 'IMPLEMENT';
  }
  if (item.action_type === 'deterministic_fix') {
    return 'IMPLEMENT';
  }
  return 'RESEARCH';
}

export function inferDomain(item) {
  if (item.domain) return item.domain.toLowerCase();
  if (item.target_notebook_name) {
    const name = item.target_notebook_name.toLowerCase();
    if (name.includes('toolforge')) return 'toolforge';
    if (name.includes('rewrite')) return 'rewrite';
    if (name.includes('sigil')) return 'sigil';
    if (name.includes('cic')) return 'cic-kb';
  }
  if (item.target_notebook) {
    const tb = item.target_notebook.toLowerCase();
    if (tb.includes('toolforge')) return 'toolforge';
    if (tb.includes('rewrite')) return 'rewrite';
    if (tb.includes('cic')) return 'cic-kb';
  }
  if (item.target) {
    const t = item.target.toLowerCase();
    if (t.includes('toolforge')) return 'toolforge';
    if (t.includes('rewrite')) return 'rewrite';
    if (t.includes('sigil')) return 'sigil';
    if (t.includes('cic')) return 'cic';
  }

  const text = `${item.id || ''} ${item.intent || ''} ${item.summary || ''}`.toLowerCase();
  if (text.includes('toolforge') || text.includes('pr45') || text.includes('devin') || text.includes('push_gate')) return 'toolforge';
  if (text.includes('rewrite')) return 'rewrite';
  if (text.includes('sigil')) return 'sigil';
  if (text.includes('robotics') || text.includes('willow') || text.includes('frontier') || text.includes('cic')) return 'cic';
  if (text.includes('audit_agent') || text.includes('exfiltration') || text.includes('sandboxes')) return 'cross-fleet';

  return 'research';
}

export function getRoutingDecision(item) {
  const category = inferCategory(item);
  const domain = inferDomain(item);
  const targetRouting = resolveTargetRouting(item.target || item.target_notebook_name || domain);

  const isResearchOrMonitor = ['RESEARCH', 'MONITOR', 'EVALUATE'].includes(category);
  const isCodeTarget = Boolean(targetRouting && targetRouting.type === 'github');
  const shouldCreateGitHubIssue = Boolean(
    (item.action_type === 'antigravity_triage') &&
    isCodeTarget &&
    !isResearchOrMonitor &&
    (category === 'IMPLEMENT' || item.target === 'toolforge' || item.target === 'rewrite')
  );

  return {
    category,
    domain,
    targetRouting,
    shouldCreateGitHubIssue,
    repo: isCodeTarget ? targetRouting.repo : null,
    targetDisplayName: targetRouting ? targetRouting.name : (domain || 'N/A')
  };
}

export function validatePayload(item) {
  if (!item.source) throw new Error('Missing source');
  if (!item.action_type || !['deterministic_fix', 'antigravity_triage'].includes(item.action_type)) {
    throw new Error(`Invalid or missing action_type: ${item.action_type}`);
  }
  if (!item.intent) throw new Error('Missing intent');
  return true;
}

export function createGitHubIssue(item, explicitRepo = null) {
  try {
    const repo = explicitRepo || item.target_repo || (resolveTargetRouting(item.target || item.domain)?.repo);
    if (!repo || repo.startsWith('local:')) {
      console.log(`[TRM-INGRESS] Bypassing GitHub issue creation for local/unmapped target: ${item.target || item.domain || 'N/A'}`);
      return null;
    }

    const priority = (item.priority || 'P2').toUpperCase();
    const category = item.category || inferCategory(item);
    const title = `[TRM-Triage] [${priority}] [${category}] ${item.intent}: ${item.summary || item.id}`;

    let body = `## TRM Mobile Action Item: \`${item.id || 'N/A'}\`\n\n`;
    body += `- **Source**: \`${item.source || 'mobile-gemini'}\`\n`;
    body += `- **Category**: \`${category}\`\n`;
    body += `- **Domain / Target**: \`${item.target_notebook_name || item.domain || item.target || repo}\`\n`;
    body += `- **Intent**: \`${item.intent}\`\n`;
    body += `- **Priority**: \`${priority}\`\n`;
    body += `- **Target Repo**: \`${repo}\`\n`;
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

    console.log(`[TRM-INGRESS] Creating GitHub Issue via gh CLI in repo ${repo}...`);
    const output = execSync(`gh issue create --repo "${repo}" --title "${title.replace(/"/g, '\\"')}" --body-file "${tmpPath}"`, {
      cwd: REPO_ROOT,
      encoding: 'utf8'
    });

    try { fs.unlinkSync(tmpPath); } catch {}
    const issueUrl = output.trim().split(/\r?\n/).pop();
    console.log(`[TRM-INGRESS] GitHub Issue created: ${issueUrl} (repo: ${repo})`);
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
  md += `| Processed At | Card ID | Source | Category / Action Type | Intent | Target | Status | Tracking / Issue |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

  // Display newest first
  for (const r of rows.slice().reverse()) {
    let statusIcon = '⏳ STAGED';
    if (r.status === 'COMPLETED') statusIcon = '✅ COMPLETED';
    else if (r.status === 'STAGED_FOR_RESEARCH') statusIcon = '🔬 RESEARCH';
    else if (r.status === 'STAGED_FOR_MONITORING') statusIcon = '📡 MONITOR';
    else if (r.status === 'STAGED_FOR_TRIAGE') statusIcon = '⏳ STAGED';
    else if (r.status === 'REJECTED') statusIcon = '🚫 REJECTED';
    else if (r.status && r.status.includes('QUARANTINE')) statusIcon = '❌ QUARANTINED';

    const target = r.target_notebook_name || r.target || r.domain || 'N/A';
    let issueLink = '—';
    if (r.issue_url) {
      const match = r.issue_url.match(/github\.com\/([^/]+\/[^/]+)\/issues\/(\d+)/);
      if (match) {
        issueLink = `[${match[1]}#${match[2]}](${r.issue_url})`;
      } else {
        issueLink = `[Issue #${r.issue_url.split('/').pop()}](${r.issue_url})`;
      }
    } else if (r.research_ref) {
      issueLink = `[${path.basename(r.research_ref)}](${r.research_ref})`;
    } else if (r.status === 'STAGED_FOR_RESEARCH') {
      issueLink = `Local Research Backlog`;
    }

    const category = r.category || (r.action_type === 'deterministic_fix' ? 'IMPLEMENT' : 'TRIAGE');
    const cardIdLabel = r.parent_action_id ? `\`${r.id || 'N/A'}\` (↳ \`${r.parent_action_id}\`)` : `\`${r.id || 'N/A'}\``;
    md += `| ${r.processed_at || r.timestamp || 'N/A'} | ${cardIdLabel} | ${r.source || 'N/A'} | \`${category}\` / \`${r.action_type || 'N/A'}\` | \`${r.intent || 'N/A'}\` | ${target} | ${statusIcon} | ${issueLink} |\n`;
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

export function auditOutboxReconciliation() {
  const ledgerRows = [];
  if (fs.existsSync(LEDGER_JSONL)) {
    try {
      const lines = fs.readFileSync(LEDGER_JSONL, 'utf8').trim().split('\n').filter(Boolean);
      for (const line of lines) {
        try { ledgerRows.push(JSON.parse(line)); } catch {}
      }
    } catch {}
  }

  // Collect all receipts across active outboxes and archive outboxes
  const activeReceiptFiles = [];
  for (const outbox of getActiveOutboxDirs()) {
    if (fs.existsSync(outbox)) {
      try {
        const files = fs.readdirSync(outbox).filter(f => f.endsWith('.json'));
        activeReceiptFiles.push(...files);
      } catch {}
    }
  }

  const archivedReceiptFiles = [];
  for (const outboxArch of getActiveOutboxArchiveDirs()) {
    if (fs.existsSync(outboxArch)) {
      try {
        const files = fs.readdirSync(outboxArch).filter(f => f.endsWith('.json'));
        archivedReceiptFiles.push(...files);
      } catch {}
    }
  }

  // Collect all archived cards from GDrive and local
  let archivedCardsCount = 0;
  if (fs.existsSync(GDRIVE_ARCHIVE)) {
    try { archivedCardsCount += fs.readdirSync(GDRIVE_ARCHIVE).length; } catch {}
  }
  if (fs.existsSync(COMPLETED_DIR)) {
    try { archivedCardsCount += fs.readdirSync(COMPLETED_DIR).filter(f => !fs.statSync(path.join(COMPLETED_DIR, f)).isDirectory()).length; } catch {}
  }

  let reconciledCardsCount = 0;
  let pendingCompletionCount = 0;
  let completedReceiptsCount = 0;
  const unreconciledCardIds = [];

  for (const row of ledgerRows) {
    const cardId = row.id;
    const safeIntent = (row.intent || '').replace(/[^a-zA-Z0-9_\-]/g, '_');
    
    // Check if a receipt matching this card exists in active or archive outboxes
    const hasReceipt = activeReceiptFiles.some(f => f.includes(safeIntent) || (cardId && f.includes(cardId))) ||
                        archivedReceiptFiles.some(f => f.includes(safeIntent) || (cardId && f.includes(cardId)));
    
    if (hasReceipt) {
      reconciledCardsCount++;
    } else if (row.status !== 'QUARANTINED') {
      unreconciledCardIds.push(cardId);
    }

    if (row.status === 'COMPLETED' || row.status === 'RESOLVED') {
      completedReceiptsCount++;
    } else {
      pendingCompletionCount++;
    }
  }

  const isReconciled = unreconciledCardIds.length === 0 && ledgerRows.length > 0;
  const reconciliationStatus = isReconciled ? 'RECONCILED' : (ledgerRows.length === 0 ? 'NO_DATA' : 'DISCREPANCY');

  return {
    timestamp: new Date().toISOString(),
    reconciliationStatus,
    archivedCardsCount,
    activeReceiptsCount: activeReceiptFiles.length,
    archivedReceiptsCount: archivedReceiptFiles.length,
    totalTrackedCount: ledgerRows.length,
    reconciledCardsCount,
    unreconciledCardIds,
    pendingCompletionCount,
    completedReceiptsCount,
    deliveryRatePercent: ledgerRows.length > 0 ? Math.round((reconciledCardsCount / ledgerRows.length) * 100) : 100
  };
}

export function syncCompletionReceipts(options = {}) {
  const dryRun = options.dryRun !== undefined ? options.dryRun : isDryRun;
  if (!fs.existsSync(LEDGER_JSONL)) return [];

  const lines = fs.readFileSync(LEDGER_JSONL, 'utf8').trim().split('\n').filter(Boolean);
  const rows = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  let mutated = false;
  const emittedReceipts = [];

  const activeReceiptFiles = [];
  for (const outbox of getActiveOutboxDirs()) {
    if (fs.existsSync(outbox)) {
      try {
        const files = fs.readdirSync(outbox).filter(f => f.endsWith('.json'));
        activeReceiptFiles.push(...files);
      } catch {}
    }
  }

  const archivedReceiptFiles = [];
  for (const outboxArch of getActiveOutboxArchiveDirs()) {
    if (fs.existsSync(outboxArch)) {
      try {
        const files = fs.readdirSync(outboxArch).filter(f => f.endsWith('.json'));
        archivedReceiptFiles.push(...files);
      } catch {}
    }
  }

  for (const item of rows) {
    let isFinished = false;
    let completionSummary = '';

    if (item.status === 'COMPLETED' || item.status === 'RESOLVED') {
      const safeIntent = (item.intent || '').replace(/[^a-zA-Z0-9_\-]/g, '_');
      const hasReceipt = activeReceiptFiles.some(f => f.includes(safeIntent) || (item.id && f.includes(item.id))) ||
                          archivedReceiptFiles.some(f => f.includes(safeIntent) || (item.id && f.includes(item.id)));
      if (hasReceipt) {
        continue;
      }
      isFinished = true;
      completionSummary = item.summary || 'Deterministic remediation executed and completed.';
    }

    // Check GitHub Issue status if present
    if (!isFinished && item.issue_url) {
      const match = item.issue_url.match(/github\.com\/([^/]+\/[^/]+)\/issues\/(\d+)/);
      if (match) {
        const repo = match[1];
        const issueNum = match[2];
        try {
          const jsonOut = execSync(`gh issue view ${issueNum} --repo "${repo}" --json state,closedAt,title`, {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'ignore']
          }).trim();
          const issueData = JSON.parse(jsonOut);
          if (issueData.state === 'CLOSED') {
            isFinished = true;
            completionSummary = `GitHub Issue #${issueNum} in ${repo} was closed at ${issueData.closedAt || 'earlier'}.`;
          }
        } catch {}
      }
    }

    // Check if local research RFC is cataloged
    if (!isFinished && item.research_ref) {
      const fullRfcPath = path.join(REPO_ROOT, item.research_ref);
      if (fs.existsSync(fullRfcPath)) {
        isFinished = true;
        completionSummary = `RFC and research note cataloged in ${item.research_ref}`;
      }
    }

    // Check if task was completed in .harness/tasks/completed
    if (!isFinished && item.id) {
      const completedTaskPath = path.join(HARNESS_COMPLETED_DIR, `${item.id}.json`);
      if (fs.existsSync(completedTaskPath)) {
        try {
          const taskData = JSON.parse(fs.readFileSync(completedTaskPath, 'utf8'));
          isFinished = true;
          completionSummary = taskData.completion_details || taskData.output || taskData.summary || `Task completed in .harness/tasks/completed/${item.id}.json`;
        } catch {
          isFinished = true;
          completionSummary = `Task completed in .harness/tasks/completed/${item.id}.json`;
        }
      }
    }

    if (isFinished) {
      item.status = 'COMPLETED';
      item.completed_at = item.completed_at || new Date().toISOString();
      mutated = true;

      const completionReceipt = {
        receipt_id: `rcpt-${Date.now()}-done-${item.id.replace(/[^a-zA-Z0-9_\-]/g, '_')}`,
        action_id: item.id,
        source: item.source || 'mobile',
        intent: item.intent,
        category: item.category || 'TRIAGE',
        target_notebook: item.target_notebook_name || item.target || 'N/A',
        action_type: item.action_type,
        status: 'COMPLETED',
        summary: `Action Completed: ${item.summary || item.intent}`,
        completion_details: completionSummary,
        issue_url: item.issue_url || null,
        research_ref: item.research_ref || null,
        completed_at: item.completed_at,
        dispatched_at: new Date().toISOString(),
        dryRun
      };

      const safeIntent = (item.intent || 'action').replace(/[^a-zA-Z0-9_\-]/g, '_');
      const fileNameJson = `receipt-${item.id}-completed.json`;
      const fileNameMd = `receipt-${item.id}-completed.md`;

      const mdContent = `# Completion Receipt: \`${completionReceipt.receipt_id}\`\n\n` +
        `- **Original Action ID**: \`${completionReceipt.action_id}\`\n` +
        `- **Status**: ✅ **COMPLETED**\n` +
        `- **Category / Domain**: \`${completionReceipt.category}\` (\`${completionReceipt.target_notebook}\`)\n` +
        `- **Intent**: \`${completionReceipt.intent}\`\n` +
        `- **Source**: \`${completionReceipt.source}\`\n` +
        `- **Completed At**: \`${completionReceipt.completed_at}\`\n` +
        (completionReceipt.issue_url ? `- **Tracking Issue**: [${completionReceipt.issue_url}](${completionReceipt.issue_url})\n` : '') +
        (completionReceipt.research_ref ? `- **Research Artifact**: [${completionReceipt.research_ref}](${completionReceipt.research_ref})\n` : '') +
        `\n### Completion Details\n${completionSummary || 'Task successfully resolved downstream.'}\n`;

      if (!dryRun) {
        for (const outbox of getActiveOutboxDirs()) {
          try {
            fs.mkdirSync(outbox, { recursive: true });
            fs.writeFileSync(path.join(outbox, fileNameJson), JSON.stringify(completionReceipt, null, 2), 'utf8');
            fs.writeFileSync(path.join(outbox, fileNameMd), mdContent, 'utf8');
          } catch (e) {
            console.warn(`[TRM-INGRESS] Could not write completion receipt to ${outbox}: ${e.message}`);
          }
        }
      }

      emittedReceipts.push(completionReceipt);
      console.log(`[TRM-INGRESS] Emitted terminal completion receipt for ${item.id} (${completionSummary})`);
    }
  }

  if (mutated && !dryRun) {
    const updatedContent = rows.map(r => JSON.stringify(r)).join('\n') + '\n';
    fs.writeFileSync(LEDGER_JSONL, updatedContent, 'utf8');
    refreshLedgerMarkdown();
  }

  return emittedReceipts;
}

export function sweepOutboxRetention(maxAgeDays = 7, options = {}) {
  const dryRun = options.dryRun !== undefined ? options.dryRun : isDryRun;
  const now = Date.now();
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  const results = {
    archivedCount: 0,
    scannedCount: 0,
    dryRun
  };

  const outboxPairs = [
    { source: GDRIVE_OUTBOX, archive: GDRIVE_OUTBOX_ARCHIVE },
    { source: LOCAL_OUTBOX_DIR, archive: LOCAL_OUTBOX_ARCHIVE },
    { source: LOCAL_DOT_TRM_OUTBOX, archive: LOCAL_DOT_TRM_OUTBOX_ARCHIVE }
  ];

  for (const { source, archive } of outboxPairs) {
    if (!fs.existsSync(source)) continue;
    try {
      const files = fs.readdirSync(source);
      results.scannedCount += files.length;

      for (const file of files) {
        const fullPath = path.join(source, file);
        try {
          const stats = fs.statSync(fullPath);
          if (!stats.isFile()) continue;

          const ageMs = now - stats.mtimeMs;
          const isStale = ageMs >= maxAgeMs;

          // Check if it's an initial staging receipt where a -completed receipt exists and is at least 1 day old
          const isStagingWithCompletion = file.startsWith('receipt-') &&
            !file.includes('-completed') &&
            files.some(f => f.includes('-completed') && f.replace('-completed', '').includes(file.replace(/receipt-\d+-/, '').replace(/\.(json|md)$/, '')));

          if (isStale || isStagingWithCompletion) {
            if (dryRun) {
              console.log(`[TRM-INGRESS] [DRY-RUN] Outbox retention candidate: ${file} (Age: ${(ageMs / (1000*3600*24)).toFixed(1)}d)`);
              results.archivedCount++;
            } else {
              fs.mkdirSync(archive, { recursive: true });
              const moved = safeMoveFile(fullPath, path.join(archive, file));
              if (moved) {
                results.archivedCount++;
                console.log(`[TRM-INGRESS] Archived outbox receipt: ${file} -> ${archive}`);
              }
            }
          }
        } catch {}
      }
    } catch {}
  }

  return results;
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
  const outboxReconciliation = auditOutboxReconciliation();

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
    activeOutboxes: getActiveOutboxDirs(),
    outboxReconciliation,
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

/**
 * Dispatch structured rejection receipt when an action card fails validation or schema parsing.
 */
export function dispatchRejectionReceipt(filename, errorMsg, rawItem = null, options = {}) {
  const dryRun = options.dryRun !== undefined ? options.dryRun : isDryRun;
  const safeId = (rawItem?.id || filename.replace(/[^a-zA-Z0-9_\-]/g, '_'));
  const receiptId = `rcpt-${Date.now()}-rej-${safeId}`;
  const outboxes = getActiveOutboxDirs();
  const receipt = {
    receipt_id: receiptId,
    action_id: rawItem?.id || filename,
    source: rawItem?.source || 'mobile',
    intent: rawItem?.intent || 'unknown',
    action_type: rawItem?.action_type || 'unknown',
    status: 'REJECTED',
    summary: `Action rejected due to validation failure: ${errorMsg}`,
    error: errorMsg,
    dispatched_at: new Date().toISOString(),
    dryRun
  };

  const fileNameJson = `receipt-${safeId}-rejected.json`;
  const fileNameMd = `receipt-${safeId}-rejected.md`;

  const mdContent = `# Rejection Receipt: \`${receipt.receipt_id}\`\n\n` +
    `- **Original File / ID**: \`${receipt.action_id}\`\n` +
    `- **Status**: ❌ **REJECTED**\n` +
    `- **Intent**: \`${receipt.intent}\`\n` +
    `- **Source**: \`${receipt.source}\`\n` +
    `- **Dispatched At**: \`${receipt.dispatched_at}\`\n` +
    `- **Error Reason**: \`${errorMsg}\`\n\n` +
    `### Remediation\n` +
    `Please check your action card JSON or Markdown frontmatter. Required fields: \`source\`, \`action_type\` (must be \`antigravity_triage\` or \`deterministic_fix\`), and \`intent\`.\n`;

  if (!dryRun) {
    for (const outbox of outboxes) {
      try {
        fs.mkdirSync(outbox, { recursive: true });
        fs.writeFileSync(path.join(outbox, fileNameJson), JSON.stringify(receipt, null, 2), 'utf8');
        fs.writeFileSync(path.join(outbox, fileNameMd), mdContent, 'utf8');
      } catch (err) {
        console.warn(`[TRM-INGRESS] Could not write rejection receipt to outbox ${outbox}: ${err.message}`);
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
    const qTarget = isFromGDrive && fs.existsSync(GDRIVE_REJECTED)
      ? path.join(GDRIVE_REJECTED, `${Date.now()}-${filename}`)
      : path.join(LOCAL_REJECTED_DIR, `${Date.now()}-${filename}`);
    const moved = safeMoveFile(filePath, qTarget);
    logToLedger({
      id: `invalid-${filename}`,
      processed_at: new Date().toISOString(),
      source: item?.source || 'unknown',
      action_type: item?.action_type || 'unknown',
      intent: item?.intent || 'validation_error',
      status: moved ? 'REJECTED' : 'QUARANTINE_MOVE_FAILED',
      error: err.message,
      duration_ms: Date.now() - startTime
    });
    dispatchRejectionReceipt(filename, err.message, item, { dryRun });
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
      const routing = getRoutingDecision(item);
      item.category = routing.category;
      item.domain = routing.domain;
      item.target_notebook_name = item.target_notebook_name || routing.targetDisplayName;

      let issueUrl = null;
      let stageStatus = 'STAGED_FOR_TRIAGE';
      if (routing.shouldCreateGitHubIssue) {
        issueUrl = createGitHubIssue(item, routing.repo);
        item.issue_url = issueUrl;
      } else {
        item.issue_url = null;
        if (routing.category === 'RESEARCH') {
          stageStatus = 'STAGED_FOR_RESEARCH';
        } else if (routing.category === 'MONITOR') {
          stageStatus = 'STAGED_FOR_MONITORING';
        }
      }

      // Check if local research RFC/note exists
      let researchRef = null;
      const safeIntent = (item.intent || '').replace(/_/g, '-');
      const candidateRfc = path.join(REPO_ROOT, `wiki/research/rfc-${safeIntent}.md`);
      const candidateIdRfc = path.join(REPO_ROOT, `wiki/research/${item.id}.md`);
      if (fs.existsSync(candidateRfc)) {
        researchRef = `wiki/research/rfc-${safeIntent}.md`;
      } else if (fs.existsSync(candidateIdRfc)) {
        researchRef = `wiki/research/${item.id}.md`;
      }

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
        console.log(`[TRM-INGRESS] Staged for ${stageStatus}: ${dest}`);
        logToLedger({
          id: itemId,
          parent_action_id: item.parent_action_id || null,
          processed_at: new Date().toISOString(),
          timestamp: item.timestamp,
          source: item.source,
          category: routing.category,
          domain: routing.domain,
          action_type: item.action_type,
          intent: item.intent,
          target_notebook: item.target_notebook,
          target_notebook_name: routing.targetDisplayName,
          summary: item.summary || item.context?.summary || '',
          issue_url: issueUrl,
          research_ref: researchRef,
          status: stageStatus,
          duration_ms: Date.now() - startTime
        });
        dispatchMobileReceipt(item, {
          status: stageStatus,
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
          category: routing.category,
          domain: routing.domain,
          action_type: item.action_type,
          intent: item.intent,
          target_notebook: item.target_notebook,
          target_notebook_name: routing.targetDisplayName,
          summary: item.summary || item.context?.summary || '',
          issue_url: issueUrl,
          research_ref: researchRef,
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
  let domain = null;
  let category = null;
  let id = stem;
  let intent = stem;

  if (parts.length >= 4) {
    // e.g. 2026-09-27T123001Z__action__cic__act-03-...
    timestamp = parts[0];
    const rawType = parts[1].toLowerCase();
    if (['research', 'monitor', 'evaluate', 'implement'].includes(rawType)) {
      category = rawType.toUpperCase();
      action_type = 'antigravity_triage';
    } else if (rawType === 'deterministic_fix') {
      action_type = 'deterministic_fix';
      category = 'IMPLEMENT';
    } else {
      action_type = 'antigravity_triage';
    }
    domain = parts[2].replace(/^target-/, '').toLowerCase();
    id = parts[3];
    intent = parts.slice(3).join('__');
  } else if (parts.length === 3) {
    timestamp = parts[0];
    const rawType = parts[1].toLowerCase();
    if (['research', 'monitor', 'evaluate'].includes(rawType)) {
      category = rawType.toUpperCase();
      action_type = 'antigravity_triage';
    } else if (rawType === 'deterministic_fix') {
      action_type = 'deterministic_fix';
      category = 'IMPLEMENT';
    } else {
      action_type = rawType === 'action' ? 'antigravity_triage' : rawType;
    }
    if (parts[2].startsWith('target-')) {
      domain = parts[2].replace(/^target-/, '').toLowerCase();
    }
    id = parts[2];
    intent = parts.slice(2).join('__');
  } else if (parts.length === 2) {
    timestamp = parts[0];
    id = parts[1];
    intent = parts[1];
  }

  let parent_action_id = null;
  for (const part of parts) {
    const match = part.match(/^(?:ref|parent|replyto)-([a-zA-Z0-9_\-]+)$/i);
    if (match) {
      parent_action_id = match[1];
      break;
    }
  }

  const cleanIntent = intent.replace(/^act-\d+-/, '').replace(/-/g, '_');

  const baseItem = {
    id,
    timestamp,
    source: 'mobile-gemini-gdoc',
    action_type: action_type === 'deterministic_fix' ? 'deterministic_fix' : 'antigravity_triage',
    category,
    domain,
    target: domain,
    parent_action_id,
    intent: cleanIntent,
    summary: parent_action_id 
      ? `Mobile action item submitted via Google Docs (follow-up to ${parent_action_id}): ${stem}`
      : `Mobile action item submitted via Google Docs: ${stem}`,
    context: {
      gdoc_filename: filename,
      gdoc_stem: stem,
      note: 'Ingested from standalone Google Drive .gdoc pointer.'
    }
  };

  const cat = category || inferCategory(baseItem);
  const dom = domain || inferDomain(baseItem);
  baseItem.category = cat;
  baseItem.domain = dom;
  baseItem.target = dom;
  baseItem.target_notebook_name = dom.toUpperCase();

  return baseItem;
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
  console.log(`[TRM-INGRESS] Ingesting standalone .gdoc card: ${item.id} | Intent: ${item.intent} | Domain: ${item.domain} | Category: ${item.category} (Dry-Run: ${dryRun})`);

  if (dryRun) {
    return { id: item.id, status: 'STAGED_STANDALONE_GDOC_DRY_RUN' };
  }

  const routing = getRoutingDecision(item);
  item.category = routing.category;
  item.domain = routing.domain;
  item.target_notebook_name = item.target_notebook_name || routing.targetDisplayName;

  let issueUrl = null;
  let stageStatus = 'STAGED_FOR_TRIAGE';
  if (routing.shouldCreateGitHubIssue) {
    issueUrl = createGitHubIssue(item, routing.repo);
    item.issue_url = issueUrl;
  } else {
    item.issue_url = null;
    if (routing.category === 'RESEARCH') {
      stageStatus = 'STAGED_FOR_RESEARCH';
    } else if (routing.category === 'MONITOR') {
      stageStatus = 'STAGED_FOR_MONITORING';
    }
  }

  // Check if local research RFC/note exists
  let researchRef = null;
  const safeIntent = (item.intent || '').replace(/_/g, '-');
  const candidateRfc = path.join(REPO_ROOT, `wiki/research/rfc-${safeIntent}.md`);
  const candidateIdRfc = path.join(REPO_ROOT, `wiki/research/${item.id}.md`);
  if (fs.existsSync(candidateRfc)) {
    researchRef = `wiki/research/rfc-${safeIntent}.md`;
  } else if (fs.existsSync(candidateIdRfc)) {
    researchRef = `wiki/research/${item.id}.md`;
  }

  const harnessTask = {
    id: item.id,
    parent_action_id: item.parent_action_id || null,
    timestamp: item.timestamp,
    source: item.source,
    category: routing.category,
    domain: routing.domain,
    target: routing.targetDisplayName,
    action_type: item.action_type,
    intent: item.intent,
    summary: item.summary,
    issue_url: issueUrl,
    research_ref: researchRef,
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
    parent_action_id: item.parent_action_id || null,
    processed_at: new Date().toISOString(),
    timestamp: item.timestamp,
    source: item.source,
    category: routing.category,
    domain: routing.domain,
    action_type: item.action_type,
    intent: item.intent,
    target_notebook_name: routing.targetDisplayName,
    status: stageStatus,
    issue_url: issueUrl,
    research_ref: researchRef,
    duration_ms: Date.now() - startTime
  });

  dispatchMobileReceipt(item, {
    status: stageStatus,
    issue_url: issueUrl,
    duration_ms: Date.now() - startTime,
    details: `Staged standalone .gdoc to .harness/tasks/pending/${item.id}.json`
  }, { dryRun });

  return { id: item.id, status: stageStatus, moved };
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

  const rec = auditOutboxReconciliation();
  console.log(`\n--- Mobile Ingress / Outbox Reconciliation ---`);
  console.log(`Reconciliation Status: ${rec.reconciliationStatus} (${rec.deliveryRatePercent}% Delivery Verified)`);
  console.log(`Archived Ingress Cards: ${rec.archivedCardsCount}`);
  console.log(`Active Outbox Receipts: ${rec.activeReceiptsCount}`);
  console.log(`Archived Receipts:      ${rec.archivedReceiptsCount}`);
  console.log(`Completed / Resolved:   ${rec.completedReceiptsCount}`);
  console.log(`Pending Completion:     ${rec.pendingCompletionCount}`);
  if (rec.unreconciledCardIds.length > 0) {
    console.log(`Unreconciled Cards:     ${rec.unreconciledCardIds.join(', ')}`);
  }
  console.log(`======================================================\n`);
  refreshLedgerMarkdown();
  emitIcfStatusFeed();
}

// CLI Execution
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))) {
  if (isStatus) {
    printStatus();
    process.exit(0);
  }

  if (isSyncReceipts) {
    console.log(`[TRM-INGRESS] Syncing terminal completion receipts downstream... (dry-run: ${isDryRun})`);
    const synced = syncCompletionReceipts({ dryRun: isDryRun });
    console.log(`[TRM-INGRESS] Synced ${synced.length} completion receipts.`);
    process.exit(0);
  }

  if (isSweepOutbox) {
    console.log(`[TRM-INGRESS] Sweeping stale outbox receipts (>7d or completed)... (dry-run: ${isDryRun})`);
    const retention = sweepOutboxRetention(7, { dryRun: isDryRun });
    console.log(`[TRM-INGRESS] Swept ${retention.archivedCount} receipts to archive (scanned: ${retention.scannedCount}).`);
    process.exit(0);
  }

  console.log(`[TRM-INGRESS] Starting Ingress Watcher on ${getActiveInboxDirs().length} active inboxes... (dry-run: ${isDryRun}, once: ${isOnce})`);
  sweepInbox({ dryRun: isDryRun });
  syncCompletionReceipts({ dryRun: isDryRun });
  sweepOutboxRetention(7, { dryRun: isDryRun });

  if (!isOnce && !isDryRun) {
    console.log(`[TRM-INGRESS] Watching for incoming action items (Ctrl+C to stop)...`);

    // Periodic 5-minute maintenance loop for sync and retention
    const POLL_INTERVAL_MS = 5 * 60 * 1000;
    setInterval(() => {
      try {
        console.log(`[TRM-INGRESS] [DAEMON-POLL] Running periodic completion sync and outbox retention sweep...`);
        syncCompletionReceipts({ dryRun: false });
        sweepOutboxRetention(7, { dryRun: false });
      } catch (pollErr) {
        console.warn(`[TRM-INGRESS] Daemon periodic poll warning: ${pollErr.message}`);
      }
    }, POLL_INTERVAL_MS);

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
