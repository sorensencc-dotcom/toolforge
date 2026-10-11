import * as fs from 'node:fs';
import * as path from 'node:path';

const DEFAULT_REPO_ROOT = path.resolve('c:/dev');
const DEFAULT_COMPLETED_DIR = path.join(DEFAULT_REPO_ROOT, '.harness', 'tasks', 'completed');

const DOMAIN_TO_REPO = {
  toolforge: 'sorensencc-dotcom/toolforge',
  sigil: 'sorensencc-dotcom/sigil',
  'rewrite-mcp': 'sorensencc-dotcom/rewrite-mcp',
  'kb-sync': 'sorensencc-dotcom/toolforge',
  'cic-kb': 'sorensencc-dotcom/toolforge'
};

/**
 * Detect if a task was already completed by checking .harness/tasks/completed.
 */
function isSafeCardId(cardId) {
  if (cardId == null || cardId === '') return false;
  const id = String(cardId);
  return !id.includes('..') && !id.includes('/') && !id.includes('\\') && !id.includes('\0');
}

export function detectCompletedTask(card, options = {}) {
  const completedDir = options.completedDir || DEFAULT_COMPLETED_DIR;
  if (!fs.existsSync(completedDir)) return null;

  const cardId = card.id || card.action_id;
  const targetId = isSafeCardId(cardId) ? `${cardId}.json` : null;

  // Direct ID file match
  if (targetId) {
    const directPath = path.join(completedDir, targetId);
    if (fs.existsSync(directPath)) {
      try {
        return JSON.parse(fs.readFileSync(directPath, 'utf8'));
      } catch {}
    }
  }

  // Scan files for intent match
  try {
    const files = fs.readdirSync(completedDir).filter(f => f.endsWith('.json'));
    for (const f of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(completedDir, f), 'utf8'));
        if ((card.id && data.id === card.id) || (card.intent && data.intent === card.intent)) {
          return data;
        }
      } catch {}
    }
  } catch {}

  return null;
}

/**
 * Evaluate if a card is speculative or unrequested over-engineering (YAGNI).
 */
export function evaluateYagni(card) {
  const text = `${card.id || ''} ${card.intent || ''} ${card.summary || ''}`.toLowerCase();

  if (text.includes('motion_exporter') || text.includes('motion design') || text.includes('animation keyframes')) {
    return {
      isYagni: true,
      status: 'DEFERRED_YAGNI',
      reason: 'Deferred speculative UI animation (YAGNI rule 1: standard reporting suffices)'
    };
  }

  return { isYagni: false };
}

/**
 * Classify reversibility into REVERSIBLE, IRREVERSIBLE, or BOUNDED.
 */
function hasToken(text, word) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(text);
}

export function classifyReversibility(card) {
  const text = `${card.intent || ''} ${card.summary || ''}`.toLowerCase();
  const pathText = [card.path, card.filePath, card.file, card.destination, card.dest, card.outputPath, card.target]
    .filter((value) => typeof value === 'string')
    .join(' ')
    .toLowerCase();

  const irreversible =
    hasToken(text, 'delete') ||
    hasToken(text, 'destroy') ||
    hasToken(text, 'truncate') ||
    hasToken(text, 'publish') ||
    text.includes('git_push') ||
    text.includes('force_push') ||
    text.includes('drop_table') ||
    text.includes('drop table') ||
    text.includes('external_sink');

  if (irreversible) return 'IRREVERSIBLE';

  const boundedSource = `${pathText} ${text}`;
  if (/(^|[\\/])(scratch|\.tmp|tmp)([\\/]|$)/.test(boundedSource) || boundedSource.includes('scratchpad')) {
    return 'BOUNDED';
  }

  return 'REVERSIBLE';
}

/**
 * Draft GitHub issue title, repo, body, and labels.
 */
export function draftIssuePayload(card) {
  const domain = (card.domain || card.target || 'toolforge').toLowerCase();
  const repo = DOMAIN_TO_REPO[domain] || 'sorensencc-dotcom/toolforge';
  const priority = card.priority || 'P2';
  const category = card.category || 'IMPLEMENT';
  const summary = card.summary || card.intent || 'New task';

  const labels = [];
  if (category === 'IMPLEMENT') {
    labels.push('enhancement');
  } else if (category === 'RESEARCH') {
    labels.push('research');
  } else {
    labels.push('evaluation');
  }

  const text = `${card.intent || ''} ${summary}`.toLowerCase();
  if (text.includes('gate') || text.includes('governance') || text.includes('security')) {
    labels.push('governance');
  }

  const body = `## Context\nAutomated mobile triage action item: ${card.id || 'N/A'}\n\n` +
    `### Directive & Objective\n${summary}\n\n` +
    `### Scope & Details\n- Domain: ${domain}\n- Intent: ${card.intent || 'N/A'}\n\n` +
    `## Acceptance Criteria\n- [ ] Implementation complete and verified with passing unit tests.\n`;

  return {
    repo,
    title: `[TRM-Triage] [${priority}] [${category}] ${summary}`,
    body,
    labels
  };
}

/**
 * Orchestrate complete triage of a card.
 */
export function triageCard(card, options = {}) {
  // 1. Check if already completed
  const completed = detectCompletedTask(card, options);
  if (completed) {
    return {
      ...card,
      status: 'COMPLETED_DUP',
      completionRecord: completed
    };
  }

  // 2. Check YAGNI
  const yagni = evaluateYagni(card);
  if (yagni.isYagni) {
    return {
      ...card,
      status: yagni.status,
      yagniReason: yagni.reason
    };
  }

  // 3. Classify reversibility & priority
  const reversibility = classifyReversibility(card);
  const priority = card.priority || 'P2';
  const status = card.category === 'RESEARCH' ? 'STAGED_FOR_RESEARCH' : 'STAGED_FOR_TRIAGE';

  // 4. Draft issue payload
  const issueDraft = draftIssuePayload(card);

  return {
    ...card,
    status,
    priority,
    reversibility,
    issueDraft
  };
}
