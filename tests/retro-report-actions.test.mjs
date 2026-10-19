import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { computeFindingId } from '../scripts/validate-retro-inbox.mjs';
import { recordedStatuses } from '../scripts/consolidate-retro-inbox.mjs';
import { buildReportActions, isoWeekKey } from '../scripts/retro-report-actions.mjs';

function finding(summary, overrides = {}) {
  const fields = { tag: 'MCP', severity: 'medium', summary, evidence: ['logs/a.log:1'], suggestion: `fix ${summary}`, ...overrides };
  return { id: computeFindingId({ repo: 'toolforge', tag: fields.tag, summary }), ...fields };
}

function entry(date, findings) {
  return { schema: 'retro-inbox/1', agent: 'claude', repo: 'toolforge', date, findings };
}

const todoLine = (box, id) => `- [${box}] item <!-- retro-finding: ${id} -->`;

function withWorkspace(inboxFiles, todos, run) {
  const root = mkdtempSync(join(tmpdir(), 'retro-actions-'));
  const inbox = join(root, '.context', 'retros', 'inbox');
  const todosFile = join(root, 'TODOS.md');
  mkdirSync(inbox, { recursive: true });
  try {
    for (const [relative, content] of Object.entries(inboxFiles)) {
      const file = join(inbox, relative);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, JSON.stringify(content, null, 2));
    }
    if (todos !== null) writeFileSync(todosFile, todos);
    return run({ inboxDir: inbox, todosFile });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('isoWeekKey follows ISO 8601 week numbering across year boundaries', () => {
  assert.equal(isoWeekKey('2026-10-18'), '2026-W42');
  assert.equal(isoWeekKey('2026-10-19'), '2026-W43');
  assert.equal(isoWeekKey('2027-01-01'), '2026-W53');
  assert.equal(isoWeekKey('2024-12-30'), '2025-W01');
});

test('recordedStatuses maps checked boxes to completed and unchecked to open', () => {
  const id = (c) => `RF-${c.repeat(12)}`;
  const text = [todoLine(' ', id('a')), todoLine('x', id('b')), todoLine('X', id('c')), `plain text <!-- retro-finding: ${id('d')} -->`].join('\r\n');
  assert.deepEqual([...recordedStatuses(text)], [[id('a'), 'open'], [id('b'), 'completed'], [id('c'), 'completed']]);
});

test('a finding from the report week is open and links to its inbox entry', () => {
  const f = finding('this week');
  withWorkspace({ 'claude/2026-10-14-a.json': entry('2026-10-14', [f]) }, null, (options) => {
    const [action] = buildReportActions({ targetDate: '2026-10-18', ...options });
    assert.equal(action.sourceId, f.id);
    assert.equal(action.sourceSystem, 'toolforge-retro');
    assert.equal(action.weekKey, '2026-W42');
    assert.equal(action.categoryId, 'reliability');
    assert.equal(action.wording, 'this week');
    assert.equal(action.status, 'open');
    assert.equal('carriedFromWeek' in action, false);
    assert.equal(action.provenanceLinks[0].path, '.context/retros/inbox/claude/2026-10-14-a.json');
    assert.ok(action.provenanceLinks[0].url.endsWith(action.provenanceLinks[0].path));
  });
});

test('an unfinished finding from an earlier week carries over', () => {
  const f = finding('older');
  withWorkspace({ 'claude/2026-10-07-a.json': entry('2026-10-07', [f]) }, todoLine(' ', f.id), (options) => {
    const [action] = buildReportActions({ targetDate: '2026-10-18', ...options });
    assert.equal(action.status, 'carried_over');
    assert.equal(action.carriedFromWeek, '2026-W41');
  });
});

test('a completed finding appears in its own week and then leaves the report', () => {
  const f = finding('done');
  const files = { 'claude/2026-10-14-a.json': entry('2026-10-14', [f]) };
  withWorkspace(files, todoLine('x', f.id), (options) => {
    assert.equal(buildReportActions({ targetDate: '2026-10-18', ...options })[0].status, 'completed');
    assert.deepEqual(buildReportActions({ targetDate: '2026-10-25', ...options }), []);
  });
});

test('findings from a later week and findings without a suggestion are left out', () => {
  const { suggestion, ...bare } = finding('record only');
  const files = {
    'claude/2026-10-21-a.json': entry('2026-10-21', [finding('future')]),
    'claude/2026-10-14-a.json': entry('2026-10-14', [bare]),
  };
  withWorkspace(files, null, (options) => {
    assert.deepEqual(buildReportActions({ targetDate: '2026-10-18', ...options }), []);
  });
});

test('a P1 finding awaiting Tier 1 still reports as open', () => {
  const f = finding('needs approval', { severity: 'high', tag: 'GATE' });
  withWorkspace({ 'claude/2026-10-14-a.json': entry('2026-10-14', [f]) }, '## Open\n', (options) => {
    const [action] = buildReportActions({ targetDate: '2026-10-18', ...options });
    assert.equal(action.status, 'open');
    assert.equal(action.categoryId, 'governance');
  });
});

test('an invalid inbox fails loudly instead of reporting an empty list', () => {
  withWorkspace({ 'claude/2026-10-14-bad.json': { schema: 'wrong' } }, null, (options) => {
    assert.throws(() => buildReportActions({ targetDate: '2026-10-18', ...options }), /retro inbox invalid/);
  });
});

test('the weekly compiler publishes the inbox actions in its report', async () => {
  const { readFileSync } = await import('node:fs');
  const compiler = readFileSync(new URL('../scripts/compile-weekly-retro.mjs', import.meta.url), 'utf8');
  assert.match(compiler, /import \{ buildReportActions \} from '\.\/retro-report-actions\.mjs'/);
  assert.match(compiler, /actions: buildReportActions\(\{ targetDate,/);
});
