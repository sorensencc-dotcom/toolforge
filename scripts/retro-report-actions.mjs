// Builds the weekly retro report `actions` array from the retro inbox, per the finding-to-action rule in docs/meta/governance/retro-policy.md.
import fs from 'node:fs';
import { INBOX_DIR, validateInbox } from './validate-retro-inbox.mjs';
import { deriveActions, recordedStatuses } from './consolidate-retro-inbox.mjs';
import { LEDGER_FILE, latestStates, readLedger } from './retro-action-ledger.mjs';

export const SOURCE_SYSTEM = 'toolforge-retro';
export const REPO_BLOB_URL = 'https://github.com/sorensencc-dotcom/toolforge/blob/main';

export function isoWeekKey(dateString) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  const thursday = new Date(date);
  thursday.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((thursday - yearStart) / 86400000 + 1) / 7);
  return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

// A finding stays on the report until the ledger closes it or its TODOS.md line is checked. A
// dismissed finding leaves the report. One that is in neither (P0 and P1 awaiting Tier 1, or no
// local TODOS.md) counts as open.
export function buildReportActions({ targetDate, inboxDir = INBOX_DIR, todosFile, ledgerFile = LEDGER_FILE } = {}) {
  const inbox = validateInbox(inboxDir);
  if (!inbox.ok) throw new Error(`retro inbox invalid:\n${inbox.errors.join('\n')}`);
  const ledger = readLedger(ledgerFile);
  if (!ledger.ok) throw new Error(`retro ledger invalid:\n${ledger.errors.join('\n')}`);
  const ledgerStates = latestStates(ledger.events);
  const statuses = todosFile && fs.existsSync(todosFile)
    ? recordedStatuses(fs.readFileSync(todosFile, 'utf8'))
    : new Map();
  const reportWeek = isoWeekKey(targetDate);
  const actions = [];
  for (const action of deriveActions(inbox.entries)) {
    const findingWeek = isoWeekKey(action.date);
    if (findingWeek > reportWeek) continue;
    const ledgerState = ledgerStates.get(action.id)?.state;
    if (ledgerState === 'dismissed') continue;
    const completed = ledgerState === 'closed' || statuses.get(action.id) === 'completed';
    if (completed && findingWeek < reportWeek) continue;
    const carried = findingWeek < reportWeek;
    actions.push({
      sourceSystem: SOURCE_SYSTEM,
      sourceId: action.id,
      weekKey: reportWeek,
      categoryId: action.icfCategory,
      wording: action.summary,
      status: completed ? 'completed' : carried ? 'carried_over' : 'open',
      ...(carried && { carriedFromWeek: findingWeek }),
      provenanceLinks: [{
        url: `${REPO_BLOB_URL}/${action.entryPath}`,
        path: action.entryPath,
        label: 'Retro inbox entry',
      }],
    });
  }
  return actions;
}
