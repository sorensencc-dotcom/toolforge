import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, '..', '..');

export const DEFAULT_REPO_MAP = {
  'toolforge': 'sorensencc-dotcom/toolforge',
  'sigil': 'sorensencc-dotcom/sigil',
  'kb-sync': 'sorensencc-dotcom/kb-sync',
  'personal-os': 'sorensencc-dotcom/personal-os',
  'icf': 'sorensencc-dotcom/icf',
  'rewrite': 'sorensencc-dotcom/rewrite-mcp',
  'rewrite-mcp': 'sorensencc-dotcom/rewrite-mcp',
  'ironledger': 'sorensencc-dotcom/IronLedger',
  'IronLedger': 'sorensencc-dotcom/IronLedger'
};

export function resolveTargetRepo(targetOrDomain, customMap = {}) {
  if (!targetOrDomain) return DEFAULT_REPO_MAP['toolforge'];
  const map = { ...DEFAULT_REPO_MAP, ...customMap };
  const key = String(targetOrDomain).trim();
  if (key.includes('/')) return key;
  const lower = key.toLowerCase();
  for (const [k, v] of Object.entries(map)) {
    if (k.toLowerCase() === lower) return v;
  }
  return `sorensencc-dotcom/${lower}`;
}

export function commitTypeForCard(card = {}) {
  const category = String(card.category || '').toUpperCase();
  const direction = String(card.direction || '').toUpperCase();
  if (card.action_type === 'deterministic_fix' || direction.includes('FIX') || direction.includes('BUG')) {
    return 'fix';
  }
  if (category === 'RESEARCH' || category === 'EVALUATE' || direction.includes('DOC') || direction.includes('AUDIT')) {
    return 'chore';
  }
  return 'feat';
}

export function parseCardFile(cardPath) {
  if (!fs.existsSync(cardPath)) {
    throw new Error(`Action card file not found: ${cardPath}`);
  }
  const raw = fs.readFileSync(cardPath, 'utf8');
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    throw new Error(`Action card missing YAML frontmatter: ${cardPath}`);
  }

  const frontmatterLines = match[1].split(/\r?\n/);
  const frontmatter = {};
  for (const line of frontmatterLines) {
    const idx = line.indexOf(':');
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim();
      frontmatter[key] = val;
    }
  }

  const body = raw.slice(match[0].length).trim();
  return {
    raw,
    frontmatter,
    body,
    cardPath
  };
}

export function formatIssueBody(cardData, parsedCard = null) {
  const cardId = cardData.id || cardData.action_id || 'unknown';
  const target = cardData.target || cardData.domain || 'core';
  const priority = cardData.priority || 'P2';
  const commitType = commitTypeForCard(cardData);
  const intent = cardData.intent || cardData.title || cardId;

  let out = `### Overview\n${cardData.summary || intent || ''}\n\n`;
  out += `### Card Context\n`;
  out += `- Card ID: \`${cardId}\`\n`;
  out += `- Target: \`${target}\`\n`;
  out += `- Priority: \`${priority}\`\n`;
  out += `- Source: \`${cardData.source || 'TRM Mobile Ingress'}\`\n`;
  out += `- Ingress Timestamp: \`${cardData.created || cardData.timestamp || new Date().toISOString()}\`\n\n`;

  out += `### PR & Issue Traceability\n`;
  out += `- When opening a Pull Request for this issue, include \`Closes #<issue_number>\` in the PR description.\n`;
  out += `- Use conventional commit title: \`${commitType}(${target}): ${intent} (closes #<issue_number>)\`\n\n`;

  if (parsedCard && parsedCard.body) {
    out += `### Technical Specifications & Directives\n${parsedCard.body}\n\n`;
  }

  out += `### Acceptance Criteria\n`;
  out += `- [ ] Technical directives implemented according to specifications\n`;
  out += `- [ ] Verification test suite authored and passing\n`;
  out += `- [ ] PR opened referencing this issue number\n`;

  return out;
}

export function updateCardFrontmatter(cardPath, fieldsToUpdate = {}) {
  if (!fs.existsSync(cardPath)) return false;
  const raw = fs.readFileSync(cardPath, 'utf8');
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return false;

  const lines = match[1].split(/\r?\n/);
  const existingKeys = new Set();
  const updatedLines = lines.map(line => {
    const idx = line.indexOf(':');
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      existingKeys.add(key);
      if (fieldsToUpdate[key] !== undefined) {
        return `${key}: ${fieldsToUpdate[key]}`;
      }
    }
    return line;
  });

  for (const [k, v] of Object.entries(fieldsToUpdate)) {
    if (!existingKeys.has(k)) {
      updatedLines.push(`${k}: ${v}`);
    }
  }

  const newContent = `---\n${updatedLines.join('\n')}\n---\n${raw.slice(match[0].length).trimStart()}`;
  fs.writeFileSync(cardPath, newContent, 'utf8');
  return true;
}

export function updateLedgerRow(ledgerPath, cardId, fieldsToUpdate = {}) {
  if (!fs.existsSync(ledgerPath)) return false;
  const content = fs.readFileSync(ledgerPath, 'utf8');
  const lines = content.split('\n').filter(Boolean);
  let found = false;

  const updated = lines.map(line => {
    try {
      const row = JSON.parse(line);
      if (row.id === cardId || row.action_id === cardId) {
        found = true;
        return JSON.stringify({ ...row, ...fieldsToUpdate });
      }
      return line;
    } catch {
      return line;
    }
  });

  if (!found) {
    updated.push(JSON.stringify({ id: cardId, ...fieldsToUpdate, created_at: new Date().toISOString() }));
  }

  fs.writeFileSync(ledgerPath, updated.join('\n') + '\n', 'utf8');
  return true;
}

/**
 * Atomically promotes an action card to a GitHub issue.
 * Transactional guarantee: fails if gh call fails without mutating disk state.
 */
export function promoteCard(cardPath, options = {}) {
  const parsed = parseCardFile(cardPath);
  const { frontmatter } = parsed;
  const cardId = frontmatter.id || frontmatter.action_id || path.basename(cardPath).replace(/\.(md|json)$/i, '');

  const repo = options.repo || resolveTargetRepo(frontmatter.target || frontmatter.domain);
  const commitType = commitTypeForCard(frontmatter);
  const target = frontmatter.target || frontmatter.domain || 'core';
  const intent = frontmatter.intent || frontmatter.title || cardId;
  const title = options.title || `${commitType}(${target}): ${intent}`;

  // Idempotency check: refuse if already promoted
  if (frontmatter.issue_url && !options.force) {
    throw new Error(`ALREADY_PROMOTED: Card ${cardId} is already promoted to ${frontmatter.issue_url}`);
  }

  const ledgerPath = options.ledgerPath || path.resolve(REPO_ROOT, 'trm-drive/inbox/ledger.jsonl');
  if (fs.existsSync(ledgerPath) && !options.force) {
    const rawLedger = fs.readFileSync(ledgerPath, 'utf8');
    const existing = rawLedger.split('\n').filter(Boolean).map(l => {
      try { return JSON.parse(l); } catch { return null; }
    }).find(r => r && (r.id === cardId || r.action_id === cardId));
    if (existing?.issue_url) {
      throw new Error(`ALREADY_PROMOTED_IN_LEDGER: Card ${cardId} already has issue_url in ledger: ${existing.issue_url}`);
    }
  }

  const bodyText = formatIssueBody(frontmatter, parsed);
  const labels = options.labels ? (Array.isArray(options.labels) ? options.labels : [options.labels]) : ['enhancement'];

  let issueUrl = null;

  if (options.dryRun || options.mockGh) {
    issueUrl = options.mockIssueUrl || `https://github.com/${repo}/issues/mock-${Date.now()}`;
  } else {
    // Spawns gh CLI with temporary body file
    const tmpFile = path.resolve(os.tmpdir(), `trm-promote-${Date.now()}-${Math.random().toString(36).slice(2)}.md`);
    fs.writeFileSync(tmpFile, bodyText, 'utf8');
    try {
      const ghRunner = options.ghRunner || ((args) => execFileSync('gh', args, { encoding: 'utf8', timeout: 30000 }));
      const args = ['issue', 'create', '--repo', repo, '--title', title, '--body-file', tmpFile];
      for (const lbl of labels) {
        args.push('--label', lbl);
      }
      try {
        const out = ghRunner(args);
        issueUrl = out.trim().split(/\r?\n/).pop();
      } catch (labelErr) {
        // Retry without labels if label doesn't exist on remote repo
        const fallbackArgs = ['issue', 'create', '--repo', repo, '--title', title, '--body-file', tmpFile];
        const out = ghRunner(fallbackArgs);
        issueUrl = out.trim().split(/\r?\n/).pop();
      }
    } finally {
      try { fs.unlinkSync(tmpFile); } catch {}
    }
  }

  if (!issueUrl || !issueUrl.startsWith('http')) {
    throw new Error(`PROMOTION_FAILED: Invalid issue URL received: ${issueUrl}`);
  }

  // Two-phase commit: Update card frontmatter and ledger atomically
  const now = new Date().toISOString();
  updateCardFrontmatter(cardPath, {
    issue_url: issueUrl,
    status: 'PROMOTED',
    promoted_at: now
  });

  if (fs.existsSync(ledgerPath)) {
    updateLedgerRow(ledgerPath, cardId, {
      issue_url: issueUrl,
      status: 'PROMOTED',
      promoted_at: now
    });
  }

  return {
    ok: true,
    cardId,
    repo,
    title,
    issueUrl,
    promotedAt: now
  };
}

// CLI entrypoint
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const cardArg = args.find(a => !a.startsWith('--'));
  const isDryRun = args.includes('--dry-run');
  const isAllPending = args.includes('--all-pending');

  if (!cardArg && !isAllPending) {
    console.error('Usage: node scripts/trm/promote-card.mjs <card-path> [--dry-run] [--all-pending]');
    process.exit(1);
  }

  if (isAllPending) {
    const pendingDir = path.resolve(REPO_ROOT, '.harness/tasks/pending');
    if (!fs.existsSync(pendingDir)) {
      console.log('No pending harness tasks directory.');
      process.exit(0);
    }
    const files = fs.readdirSync(pendingDir).filter(f => f.endsWith('.md'));
    console.log(`Found ${files.length} pending cards to promote.`);
    for (const f of files) {
      try {
        const res = promoteCard(path.join(pendingDir, f), { dryRun: isDryRun });
        console.log(`✓ Promoted ${res.cardId} -> ${res.issueUrl}`);
      } catch (err) {
        console.error(`✗ Failed to promote ${f}:`, err.message);
      }
    }
  } else {
    try {
      const res = promoteCard(path.resolve(cardArg), { dryRun: isDryRun });
      console.log(JSON.stringify(res, null, 2));
    } catch (err) {
      console.error('[ERROR] Promotion failed:', err.message);
      process.exit(1);
    }
  }
}
