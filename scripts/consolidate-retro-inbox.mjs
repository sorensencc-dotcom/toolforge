#!/usr/bin/env node
// Turns retro inbox findings into TODOS.md actions, per the finding-to-action rule in docs/meta/governance/retro-policy.md.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { INBOX_DIR, INBOX_REGISTRY, validateInbox } from './validate-retro-inbox.mjs';
import { LEDGER_FILE, latestStates, readLedger } from './retro-action-ledger.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const USAGE = 'usage: node scripts/consolidate-retro-inbox.mjs [--dry-run] [--todos <file>] [--inbox <dir>] [--ledger <file>]';
const MARKER = /<!--\s*retro-finding:\s*(RF-[0-9a-f]{12})\s*-->/g;
const OPEN_HEADING = /^## Open[^\S\r\n]*$/m;
const NEXT_HEADING = /^## /m;

export function deriveActions(entries, registry = INBOX_REGISTRY) {
  const seen = new Set();
  const actions = [];
  for (const { path: entryPath, entry } of entries) {
    for (const finding of entry.findings) {
      if (finding.suggestion === undefined || seen.has(finding.id)) continue;
      seen.add(finding.id);
      const priority = registry.severities[finding.severity].priority;
      actions.push({
        id: finding.id,
        repo: entry.repo,
        date: entry.date,
        tag: finding.tag,
        severity: finding.severity,
        priority,
        icfCategory: registry.tags[finding.tag].icfCategory,
        summary: finding.summary,
        suggestion: finding.suggestion,
        evidence: finding.evidence,
        todosAppend: registry.priorities[priority].todosAppend,
        entryPath,
      });
    }
  }
  return actions;
}

export function recordedIds(todosText) {
  return new Set([...todosText.matchAll(MARKER)].map((match) => match[1]));
}

export function recordedStatuses(todosText) {
  const statuses = new Map();
  for (const line of todosText.split(/\r?\n/)) {
    const checkbox = /^\s*[-*]\s+\[([ xX])\]/.exec(line);
    if (!checkbox) continue;
    for (const match of line.matchAll(MARKER)) statuses.set(match[1], checkbox[1] === ' ' ? 'open' : 'completed');
  }
  return statuses;
}

export function renderTodoLine(action) {
  return `- [ ] **[${action.priority}] ${action.summary}** (created ${action.date}, ${action.repo} ${action.tag}) — ${action.suggestion} <!-- retro-finding: ${action.id} -->`;
}

// A ledger event beats the TODOS.md line: closed and dismissed findings never come back, and an
// approved P0 or P1 finding is appended like a P2 one.
export function applyActions(todosText, actions, ledger = new Map()) {
  const known = recordedIds(todosText);
  const appended = [];
  const pending = [];
  const recorded = [];
  const settled = [];
  for (const action of actions) {
    const state = ledger.get(action.id)?.state;
    if (known.has(action.id)) recorded.push(action);
    else if (state === 'closed' || state === 'dismissed') settled.push(action);
    else if (action.todosAppend === 'auto' || state === 'approved') appended.push(action);
    else pending.push(action);
  }
  if (appended.length === 0) return { text: todosText, appended, pending, recorded, settled };

  const eol = todosText.includes('\r\n') ? '\r\n' : '\n';
  const open = OPEN_HEADING.exec(todosText);
  if (!open) throw new Error('TODOS.md has no "## Open" section to append retro actions to');
  const afterOpen = open.index + open[0].length;
  const next = NEXT_HEADING.exec(todosText.slice(afterOpen));
  const sectionEnd = next ? afterOpen + next.index : todosText.length;
  const section = todosText.slice(afterOpen, sectionEnd).replace(/\s+$/, '');
  const lines = appended.map(renderTodoLine).join(eol);
  const tail = next ? `${eol}${eol}${todosText.slice(sectionEnd)}` : eol;
  return {
    text: `${todosText.slice(0, afterOpen)}${section}${eol}${lines}${tail}`,
    appended,
    pending,
    recorded,
    settled,
  };
}

export function consolidate({ inboxDir = INBOX_DIR, todosFile, ledgerFile = LEDGER_FILE, dryRun = false } = {}) {
  const inbox = validateInbox(inboxDir);
  if (!inbox.ok) return { ok: false, errors: inbox.errors };
  const ledger = readLedger(ledgerFile);
  if (!ledger.ok) return { ok: false, errors: ledger.errors.map((message) => `${ledgerFile}: ${message}`) };
  const before = fs.readFileSync(todosFile, 'utf8');
  const result = applyActions(before, deriveActions(inbox.entries), latestStates(ledger.events));
  if (!dryRun && result.text !== before) fs.writeFileSync(todosFile, result.text);
  return { ok: true, ...result };
}

function main(argv) {
  let values;
  try {
    ({ values } = parseArgs({
      args: argv,
      options: { 'dry-run': { type: 'boolean' }, todos: { type: 'string' }, inbox: { type: 'string' }, ledger: { type: 'string' } },
      strict: true,
    }));
  } catch {
    console.error(USAGE);
    return 2;
  }
  const todosFile = path.resolve(values.todos ?? path.join(ROOT, 'TODOS.md'));
  if (!fs.existsSync(todosFile)) {
    console.error(`retro consolidate: ${todosFile} does not exist. TODOS.md is gitignored; run this where it lives or pass --todos.`);
    return 1;
  }
  const result = consolidate({
    inboxDir: values.inbox ?? INBOX_DIR,
    todosFile,
    ledgerFile: values.ledger ?? path.join(ROOT, LEDGER_FILE),
    dryRun: values['dry-run'],
  });
  if (!result.ok) {
    console.error(`retro consolidate: inbox invalid (${result.errors.length} errors)`);
    for (const error of result.errors) console.error(`  ${error}`);
    return 1;
  }
  const verb = values['dry-run'] ? 'would append' : 'appended';
  for (const action of result.appended) console.log(`  ${action.id} ${action.priority} ${action.summary}`);
  for (const action of result.pending) console.log(`  ${action.id} ${action.priority} awaits Tier 1 approval (retro-action-ledger.mjs append --state approved): ${action.summary}`);
  console.log(`retro consolidate: ${verb} ${result.appended.length}, ${result.pending.length} awaiting Tier 1, ${result.recorded.length} already recorded, ${result.settled.length} closed or dismissed`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
