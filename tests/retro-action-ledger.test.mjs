import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { computeFindingId } from '../scripts/validate-retro-inbox.mjs';
import { applyActions, consolidate, deriveActions } from '../scripts/consolidate-retro-inbox.mjs';
import { buildReportActions } from '../scripts/retro-report-actions.mjs';
import { appendEvent, latestStates, readLedger } from '../scripts/retro-action-ledger.mjs';

const CLI = fileURLToPath(new URL('../scripts/retro-action-ledger.mjs', import.meta.url));
const OPEN = '# TODOS\n\n## Open\n\n- [ ] existing item\n';

function finding(summary, severity) {
  const fields = { tag: 'MCP', severity, summary, evidence: ['logs/a.log:1'], suggestion: `fix ${summary}` };
  return { id: computeFindingId({ repo: 'toolforge', tag: 'MCP', summary }), ...fields };
}

const HIGH = finding('high finding', 'high');
const LOW = finding('low finding', 'low');
const entry = { schema: 'retro-inbox/1', agent: 'claude', repo: 'toolforge', date: '2026-10-17', findings: [HIGH, LOW] };
const event = (id, state, extra = {}) => ({ id, state, by: 'Chris', date: '2026-10-19', ...extra });

function withWorkspace(ledgerEvents, run) {
  const root = mkdtempSync(join(tmpdir(), 'retro-ledger-'));
  const inbox = join(root, '.context', 'retros', 'inbox');
  const inboxFile = join(inbox, 'claude', '2026-10-17-ledger-test.json');
  const ledgerFile = join(root, '.context', 'retros', 'actions', 'ledger.jsonl');
  const todosFile = join(root, 'TODOS.md');
  try {
    mkdirSync(dirname(inboxFile), { recursive: true });
    writeFileSync(inboxFile, JSON.stringify(entry, null, 2));
    writeFileSync(todosFile, OPEN);
    if (ledgerEvents) {
      mkdirSync(dirname(ledgerFile), { recursive: true });
      writeFileSync(ledgerFile, ledgerEvents.map((e) => JSON.stringify(e)).join('\n') + '\n');
    }
    return run({ inbox, ledgerFile, todosFile });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('readLedger accepts a missing file and reports each bad line', () => {
  withWorkspace(null, ({ ledgerFile }) => assert.deepEqual(readLedger(ledgerFile), { ok: true, errors: [], events: [] }));
  withWorkspace([event(HIGH.id, 'approved')], ({ ledgerFile }) => {
    writeFileSync(ledgerFile, `${JSON.stringify(event(HIGH.id, 'maybe'))}\nnot json\n${JSON.stringify({ ...event(HIGH.id, 'closed'), extra: 1 })}\n`);
    const { ok, errors, events } = readLedger(ledgerFile);
    assert.equal(ok, false);
    assert.equal(events.length, 0);
    assert.match(errors.join('\n'), /line 1: state: must be one of/);
    assert.match(errors.join('\n'), /line 2: is not valid JSON/);
    assert.match(errors.join('\n'), /line 3: extra: is not an allowed field/);
  });
});

test('the last event for an id decides its state', () => {
  const states = latestStates([event(HIGH.id, 'approved'), event(HIGH.id, 'closed')]);
  assert.equal(states.get(HIGH.id).state, 'closed');
});

test('an approved P1 finding is appended and an unapproved one stays pending', () => {
  const actions = deriveActions([{ path: 'p', entry }]);
  const pending = applyActions(OPEN, actions, new Map());
  assert.deepEqual(pending.pending.map((a) => a.id), [HIGH.id]);
  assert.deepEqual(pending.appended.map((a) => a.id), [LOW.id]);
  const approved = applyActions(OPEN, actions, latestStates([event(HIGH.id, 'approved')]));
  assert.deepEqual(approved.appended.map((a) => a.id).sort(), [HIGH.id, LOW.id].sort());
  assert.equal(approved.pending.length, 0);
});

test('closed and dismissed findings never return after their TODOS.md line is deleted', () => {
  const actions = deriveActions([{ path: 'p', entry }]);
  const result = applyActions(OPEN, actions, latestStates([event(LOW.id, 'closed'), event(HIGH.id, 'dismissed')]));
  assert.deepEqual(result.appended, []);
  assert.deepEqual(result.pending, []);
  assert.deepEqual(result.settled.map((a) => a.id).sort(), [HIGH.id, LOW.id].sort());
  assert.equal(result.text, OPEN);
});

test('consolidate reads the ledger file and rejects an invalid one', () => {
  withWorkspace([event(HIGH.id, 'approved')], ({ inbox, ledgerFile, todosFile }) => {
    const result = consolidate({ inboxDir: inbox, todosFile, ledgerFile, dryRun: true });
    assert.equal(result.appended.length, 2);
    writeFileSync(ledgerFile, 'not json\n');
    const bad = consolidate({ inboxDir: inbox, todosFile, ledgerFile, dryRun: true });
    assert.equal(bad.ok, false);
  });
});

test('the report drops dismissed findings and marks closed ones completed', () => {
  withWorkspace([event(HIGH.id, 'dismissed'), event(LOW.id, 'closed')], ({ inbox, ledgerFile, todosFile }) => {
    const sameWeek = buildReportActions({ targetDate: '2026-10-18', inboxDir: inbox, todosFile, ledgerFile });
    assert.deepEqual(sameWeek.map((a) => [a.sourceId, a.status]), [[LOW.id, 'completed']]);
    const later = buildReportActions({ targetDate: '2026-10-25', inboxDir: inbox, todosFile, ledgerFile });
    assert.deepEqual(later, []);
  });
});

test('appendEvent rejects an id that is not in the inbox and appends a known one', () => {
  withWorkspace(null, ({ inbox, ledgerFile }) => {
    const unknown = appendEvent({ ledgerFile, inboxDir: inbox, event: event('RF-000000000000', 'approved') });
    assert.equal(unknown.ok, false);
    const ok = appendEvent({ ledgerFile, inboxDir: inbox, event: event(HIGH.id, 'approved', { ref: 'chat 2026-10-19' }) });
    assert.equal(ok.ok, true);
    assert.equal(readLedger(ledgerFile).events[0].ref, 'chat 2026-10-19');
  });
});

test('the CLI appends an event and validates the ledger', () => {
  withWorkspace(null, ({ inbox, ledgerFile }) => {
    const append = spawnSync(process.execPath, [CLI, 'append', '--id', HIGH.id, '--state', 'approved', '--by', 'Chris', '--date', '2026-10-19', '--ledger', ledgerFile, '--inbox', inbox], { encoding: 'utf8', timeout: 30000 });
    assert.equal(append.status, 0, append.stderr);
    assert.equal(readFileSync(ledgerFile, 'utf8'), `${JSON.stringify(event(HIGH.id, 'approved'))}\n`);
    const validate = spawnSync(process.execPath, [CLI, 'validate', '--ledger', ledgerFile], { encoding: 'utf8', timeout: 30000 });
    assert.equal(validate.status, 0, validate.stderr);
    const bad = spawnSync(process.execPath, [CLI, 'append', '--id', HIGH.id, '--state', 'nope', '--by', 'Chris', '--ledger', ledgerFile, '--inbox', inbox], { encoding: 'utf8', timeout: 30000 });
    assert.equal(bad.status, 1);
  });
});
