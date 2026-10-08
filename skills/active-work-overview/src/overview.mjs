/**
 * active-work-overview
 * Aggregates active engineering worktrees, open pull requests, recent landings,
 * open backlog items (TODOS.md), mobile action receipts, and daemon health into
 * a single structured report.
 */

import { execSync } from 'node:child_process'; // noqa: SEC-AUDITOR - read-only local git worktree list and gh token lookup
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

let cachedToken = null;
export function getGitHubToken() {
  if (cachedToken) return cachedToken;
  if (process.env.GITHUB_TOKEN) return (cachedToken = process.env.GITHUB_TOKEN);
  if (process.env.GH_TOKEN) return (cachedToken = process.env.GH_TOKEN);
  try {
    const out = execSync('gh auth token', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 3000 });
    return (cachedToken = out.trim() || null);
  } catch {
    return null;
  }
}

export async function fetchOpenPullRequests(options = {}) {
  const { user = 'sorensencc-dotcom', token = getGitHubToken(), timeoutMs = 6000 } = options;
  if (!token) return [];

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const query = encodeURIComponent(`user:${user} is:pr state:open`);
    const res = await fetch(`https://api.github.com/search/issues?q=${query}&sort=updated&order=desc`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': 'Toolforge-ActiveWorkOverview',
        Accept: 'application/vnd.github.v3+json'
      },
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items || []).map(item => {
      const repoParts = (item.repository_url || '').split('/');
      const repo = repoParts.slice(-2).join('/');
      return {
        number: item.number,
        title: item.title,
        repo,
        url: item.html_url,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        state: item.state
      };
    });
  } catch {
    return [];
  }
}

export async function fetchRecentLandings(options = {}) {
  const { user = 'sorensencc-dotcom', token = getGitHubToken(), limit = 5, timeoutMs = 6000 } = options;
  if (!token) return [];

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const query = encodeURIComponent(`user:${user} is:pr is:merged sort:updated-desc`);
    const res = await fetch(`https://api.github.com/search/issues?q=${query}&per_page=${limit}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': 'Toolforge-ActiveWorkOverview',
        Accept: 'application/vnd.github.v3+json'
      },
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items || []).map(item => {
      const repoParts = (item.repository_url || '').split('/');
      const repo = repoParts.slice(-2).join('/');
      return {
        number: item.number,
        title: item.title,
        repo,
        url: item.html_url,
        closedAt: item.closed_at
      };
    });
  } catch {
    return [];
  }
}

export function parseWorktreePorcelain(porcelainOutput) {
  const worktrees = [];
  const entries = porcelainOutput.trim().split(/\n\n+/);
  for (const entry of entries) {
    if (!entry.trim()) continue;
    const lines = entry.trim().split('\n');
    let path = '';
    let head = '';
    let branch = '';
    let bare = false;
    for (const line of lines) {
      if (line.startsWith('worktree ')) path = line.slice(9).trim();
      else if (line.startsWith('HEAD ')) head = line.slice(5).trim();
      else if (line.startsWith('branch ')) branch = line.slice(7).replace('refs/heads/', '').trim();
      else if (line === 'bare') bare = true;
    }
    if (path) {
      worktrees.push({ path, head, branch: branch || '(detached)', bare });
    }
  }
  return worktrees;
}

export function collectWorktrees(workspaceRoot = 'C:\\dev') {
  const results = [];
  const targetRoots = [workspaceRoot, join(workspaceRoot, 'sigil-repo')];

  for (const root of targetRoots) {
    if (!existsSync(root)) continue;
    try {
      const output = execSync('git worktree list --porcelain', {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 4000
      });
      const parsed = parseWorktreePorcelain(output);
      for (const wt of parsed) {
        if (!wt.bare && existsSync(wt.path)) {
          try {
            const commitSubject = execSync('git --no-pager log -1 --format=%s', {
              cwd: wt.path,
              encoding: 'utf8',
              stdio: ['ignore', 'pipe', 'ignore'],
              timeout: 2000
            }).trim();
            wt.lastCommit = commitSubject;
          } catch {
            wt.lastCommit = '';
          }
        }
        results.push(wt);
      }
    } catch {
      // Ignore git errors for non-repo roots
    }
  }

  // Deduplicate by path
  const seen = new Set();
  return results.filter(w => {
    const key = w.path.toLowerCase().replace(/\\/g, '/');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function parseTodos(content) {
  const openMatch = content.match(/## Open\s+([\s\S]*?)(?=## Completed|$)/i);
  if (!openMatch) return [];
  const openBlock = openMatch[1];
  const items = [];
  const lines = openBlock.split('\n');
  let currentItem = null;

  for (const line of lines) {
    const itemMatch = line.match(/^\s*-\s*\[ \]\s*(\*\*\[(P[0-9\?])\]\s*([^(\n]+?)\*\*\s*(?:\(([^)]+)\))?)\s*(?:—\s*(.*))?$/i);
    if (itemMatch) {
      if (currentItem) items.push(currentItem);
      currentItem = {
        priority: itemMatch[2].toUpperCase(),
        title: itemMatch[3].trim(),
        meta: (itemMatch[4] || '').trim(),
        detail: (itemMatch[5] || '').trim()
      };
    } else if (currentItem && line.trim().startsWith('-') && !line.trim().startsWith('- [ ]')) {
      currentItem.detail += (currentItem.detail ? ' ' : '') + line.trim().replace(/^-\s*/, '');
    }
  }
  if (currentItem) items.push(currentItem);
  return items;
}

export function collectTodos(workspaceRoot = 'C:\\dev') {
  const todosFile = join(workspaceRoot, 'TODOS.md');
  if (!existsSync(todosFile)) return [];
  try {
    const raw = readFileSync(todosFile, 'utf8');
    return parseTodos(raw);
  } catch {
    return [];
  }
}

export function collectOutboxReceipts(workspaceRoot = 'C:\\dev') {
  const outboxDirs = [
    join(workspaceRoot, 'trm-drive', 'inbox', 'outbox'),
    join(workspaceRoot, '.trm', 'inbox', 'outbox')
  ];

  const receipts = [];
  for (const dir of outboxDirs) {
    if (!existsSync(dir)) continue;
    try {
      const files = readdirSync(dir).filter(f => f.endsWith('.json'));
      for (const f of files) {
        try {
          const content = JSON.parse(readFileSync(join(dir, f), 'utf8'));
          receipts.push({ file: f, ...content });
        } catch {}
      }
    } catch {}
  }

  const receiptMap = new Map();
  for (const r of receipts) {
    const raw = r.action_id || r.intent || r.receipt_id || r.file || '';
    const key = raw.replace(/-completed$/, '').replace(/^rcpt-\d+-done-/, '').replace(/^rcpt-\d+-/, '').replace(/^receipt-\d+-/, '').replace(/_/g, '-').toLowerCase().trim();
    if (!key) continue;
    const existing = receiptMap.get(key);
    if (!existing) {
      receiptMap.set(key, r);
    } else {
      const isCompleted = r.status === 'COMPLETED' || existing.status === 'COMPLETED';
      receiptMap.set(key, { ...existing, ...r, status: isCompleted ? 'COMPLETED' : (r.status || existing.status) });
    }
  }

  return Array.from(receiptMap.values());
}

export function collectTelemetry(workspaceRoot = 'C:\\dev') {
  const statusFeedDir = join(workspaceRoot, '_status-feed');
  const telemetry = {
    ironledger: null,
    kbSync: null,
    ciAlerts: null,
    daemon8080: null
  };

  const ironledgerPath = join(statusFeedDir, 'ironledger_health.json');
  if (existsSync(ironledgerPath)) {
    try {
      const data = JSON.parse(readFileSync(ironledgerPath, 'utf8'));
      telemetry.ironledger = {
        status: data.status,
        version: data.workbench?.version,
        containerRunning: data.workbench?.container?.running,
        invariantsPassed: data.invariants?.passed,
        dbSizeBytes: data.database?.sizeBytes,
        scheduledSyncsStatus: data.scheduledSyncs?.status
      };
    } catch {}
  }

  const dailyPath = join(statusFeedDir, 'daily_status.json');
  if (existsSync(dailyPath)) {
    try {
      const data = JSON.parse(readFileSync(dailyPath, 'utf8'));
      telemetry.kbSync = {
        syncStatus: data.kb_sync?.sync_status,
        fileCount: data.kb_sync?.file_count,
        driftStatus: data.kb_sync?.drift_status,
        stalePages: data.kb_sync?.drift_stale_pages,
        openTodosCount: data.todos?.total_open
      };
    } catch {}
  }

  const ciPath = join(statusFeedDir, 'ci_alerts.json');
  if (existsSync(ciPath)) {
    try {
      const data = JSON.parse(readFileSync(ciPath, 'utf8'));
      telemetry.ciAlerts = {
        status: data.status,
        failureCount: data.failureCount,
        recentFailure: data.recentRuns?.find(r => r.conclusion === 'failure')?.name || null
      };
    } catch {}
  }

  const daemonPath = join(statusFeedDir, 'daemon_health.json');
  if (existsSync(daemonPath)) {
    try {
      const data = JSON.parse(readFileSync(daemonPath, 'utf8'));
      telemetry.daemon8080 = {
        status: data.status,
        consecutiveHeals: data.consecutiveHeals,
        thrashCooldown: data.thrashCooldownActive
      };
    } catch {}
  }

  return telemetry;
}

export async function buildOverviewReport(options = {}) {
  const workspaceRoot = options.workspaceRoot || 'C:\\dev';
  const user = options.user || 'sorensencc-dotcom';

  const [pullRequests, recentLandings] = await Promise.all([
    fetchOpenPullRequests({ user }),
    fetchRecentLandings({ user, limit: 5 })
  ]);

  const worktrees = collectWorktrees(workspaceRoot);
  const todos = collectTodos(workspaceRoot);
  const outboxReceipts = collectOutboxReceipts(workspaceRoot);
  const telemetry = collectTelemetry(workspaceRoot);

  return {
    timestamp: new Date().toISOString(),
    workspaceRoot,
    pullRequests,
    recentLandings,
    worktrees,
    todos,
    outboxReceipts,
    telemetry
  };
}

export function formatReportMarkdown(report) {
  const { timestamp, pullRequests, recentLandings, worktrees, todos, outboxReceipts, telemetry } = report;
  const activeReceipts = outboxReceipts.filter(r => r.status && r.status !== 'COMPLETED');
  const dateStr = new Date(timestamp).toLocaleString();

  let md = `# Ecosystem Active Work Overview\n\n`;
  md += `> Generated: **${dateStr}** · Workspace: \`${report.workspaceRoot}\`\n\n`;

  // 1. Pull Requests
  md += `## 1. Pull Requests\n\n`;
  if (pullRequests.length === 0) {
    md += `*No open pull requests.*\n\n`;
  } else {
    md += `| Repo | PR | Title | Updated |\n`;
    md += `| :--- | :--- | :--- | :--- |\n`;
    for (const pr of pullRequests) {
      const date = new Date(pr.updatedAt || pr.createdAt).toISOString().split('T')[0];
      md += `| \`${pr.repo}\` | [#${pr.number}](${pr.url}) | ${pr.title} | ${date} |\n`;
    }
    md += `\n`;
  }

  if (recentLandings.length > 0) {
    md += `### Recently Merged Landings\n\n`;
    for (const landing of recentLandings) {
      const date = landing.closedAt ? new Date(landing.closedAt).toISOString().split('T')[0] : '';
      md += `- [**${landing.repo}#${landing.number}**](${landing.url}): ${landing.title} (${date})\n`;
    }
    md += `\n`;
  }

  // 2. Active Worktrees
  md += `## 2. Active Engineering Worktrees\n\n`;
  if (worktrees.length === 0) {
    md += `*No active git worktrees found.*\n\n`;
  } else {
    md += `| Worktree Path | Branch | Latest Commit |\n`;
    md += `| :--- | :--- | :--- |\n`;
    for (const wt of worktrees) {
      const cleanPath = wt.path.replace(/\\/g, '/');
      const base = cleanPath.split('/').pop();
      const commit = wt.lastCommit
        ? (wt.lastCommit.length > 50 ? `${wt.lastCommit.slice(0, 47)}...` : wt.lastCommit)
        : wt.head.slice(0, 7);
      md += `| \`.../${base}\` | \`${wt.branch}\` | ${commit} |\n`;
    }
    md += `\n`;
  }

  // 3. Backlog Items (TODOS.md)
  md += `## 3. Open Backlog Items ([TODOS.md](file:///${report.workspaceRoot.replace(/\\/g, '/')}/TODOS.md))\n\n`;
  if (todos.length === 0) {
    md += `*No open items in TODOS.md.*\n\n`;
  } else {
    for (const todo of todos) {
      const badge = todo.priority === 'P0' ? '🔴 **P0**' : (todo.priority === 'P1' ? '🟡 **P1**' : '⚪ **P2**');
      md += `- ${badge}: **${todo.title}** ${todo.meta ? `(${todo.meta})` : ''}\n`;
      if (todo.detail) {
        md += `  - ${todo.detail.slice(0, 140)}${todo.detail.length > 140 ? '...' : ''}\n`;
      }
    }
    md += `\n`;
  }

  // 4. Live Action Receipts
  md += `## 4. Mobile Action Receipts & Ingress\n\n`;
  if (activeReceipts.length === 0) {
    md += `*Queue clear — zero active pending cards in outbox buffer.*\n\n`;
  } else {
    for (const r of activeReceipts) {
      const issueLink = r.issue_url ? ` · [Issue](${r.issue_url})` : '';
      md += `- **[${r.status || 'PENDING'}]** \`${r.action_id || r.intent}\` (${r.duration_ms || 0}ms)${issueLink}\n`;
    }
    md += `\n`;
  }

  // 5. System & Daemon Health
  md += `## 5. System & Daemon Health\n\n`;
  md += `| Subsystem | Status | Key Metrics |\n`;
  md += `| :--- | :--- | :--- |\n`;
  if (telemetry.ironledger) {
    const il = telemetry.ironledger;
    const dbMb = il.dbSizeBytes ? `${(il.dbSizeBytes / (1024 * 1024)).toFixed(1)}MB` : 'N/A';
    md += `| **IronLedger** | \`${il.status}\` | Container: ${il.containerRunning ? 'running' : 'down'} · Invariants: ${il.invariantsPassed ? 'PASS' : 'FAIL'} · DB: ${dbMb} |\n`;
  }
  if (telemetry.kbSync) {
    const kb = telemetry.kbSync;
    md += `| **KB-Sync** | \`${kb.syncStatus}\` | Files: ${kb.fileCount} · Drift: ${kb.driftStatus} (${kb.stalePages} stale) |\n`;
  }
  if (telemetry.daemon8080) {
    const d = telemetry.daemon8080;
    md += `| **Daemon (Port 8080)** | \`${d.status}\` | Consecutive heals: ${d.consecutiveHeals} · Thrash cooldown: ${d.thrashCooldown ? 'active' : 'idle'} |\n`;
  }
  if (telemetry.ciAlerts) {
    const ci = telemetry.ciAlerts;
    md += `| **CI Alerts** | \`${ci.status}\` | Failures: ${ci.failureCount} · Recent: ${ci.recentFailure || 'none'} |\n`;
  }
  md += `\n`;

  return md;
}

// CLI entrypoint
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const isJson = process.argv.includes('--json');
  buildOverviewReport().then(report => {
    if (isJson) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(formatReportMarkdown(report));
    }
  }).catch(err => {
    console.error('Failed to generate active work overview:', err);
    process.exit(1);
  });
}
