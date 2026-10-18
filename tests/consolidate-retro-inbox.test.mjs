import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { computeFindingId } from '../scripts/validate-retro-inbox.mjs';
import {
  applyActions,
  consolidate,
  deriveActions,
  recordedIds,
  renderTodoLine,
} from '../scripts/consolidate-retro-inbox.mjs';

const SCRIPT = fileURLToPath(new URL('../scripts/consolidate-retro-inbox.mjs', import.meta.url));
const OPEN = '# TODOS\n\n## Open\n\n- [ ] existing item\n\n## Done\n\n- [x] shipped\n';

function finding(summary, overrides = {}) {
  const fields = { tag: 'MCP', severity: 'medium', summary, evidence: ['logs/a.log:1'], suggestion: `fix ${summary}`, ...overrides };
  return { id: computeFindingId({ repo: 'toolforge', tag: fields.tag, summary }), ...fields };
}

function entry(findings, overrides = {}) {
  return { schema: 'retro-inbox/1', agent: 'claude', repo: 'toolforge', date: '2026-10-17', findings, ...overrides };
}

function action(summary, overrides = {}) {
  return deriveActions([{ entry: entry([finding(summary, overrides)]) }])[0];
}

function withWorkspace(inboxFiles, todos, run) {
  const root = mkdtempSync(join(tmpdir(), 'retro-consolidate-'));
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
    return run({ inbox, todosFile });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function runCli(args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', timeout: 30000 });
}

test('deriveActions skips findings without a suggestion', () => {
  const { suggestion, ...bare } = finding('no suggestion');
  assert.deepEqual(deriveActions([{ entry: entry([bare]) }]), []);
});

test('deriveActions maps severity to priority and tag to ICF category', () => {
  const [critical, low] = deriveActions([
    { entry: entry([finding('a', { severity: 'critical', tag: 'GATE' }), finding('b', { severity: 'low', tag: 'CI' })]) },
  ]);
  assert.equal(critical.priority, 'P0');
  assert.equal(critical.icfCategory, 'governance');
  assert.equal(critical.todosAppend, 'approval');
  assert.equal(low.priority, 'P2');
  assert.equal(low.icfCategory, 'quality');
  assert.equal(low.todosAppend, 'auto');
});

test('deriveActions keeps one action per finding id across entries', () => {
  const dup = finding('same finding');
  const actions = deriveActions([{ entry: entry([dup]) }, { entry: entry([dup], { date: '2026-10-18' }) }]);
  assert.equal(actions.length, 1);
  assert.equal(actions[0].date, '2026-10-17');
});

test('recordedIds reads retro-finding markers and ignores other text', () => {
  const text = 'a <!-- retro-finding: RF-67037cac182c --> b <!--retro-finding:RF-aaaaaaaaaaaa--> RF-bbbbbbbbbbbb';
  assert.deepEqual([...recordedIds(text)].sort(), ['RF-67037cac182c', 'RF-aaaaaaaaaaaa']);
});

test('applyActions appends P2 actions to the end of the Open section', () => {
  const a = action('graft cold start');
  const result = applyActions(OPEN, [a]);
  assert.deepEqual(result.appended, [a]);
  assert.equal(
    result.text,
    `# TODOS\n\n## Open\n\n- [ ] existing item\n${renderTodoLine(a)}\n\n## Done\n\n- [x] shipped\n`,
  );
});

test('applyActions is idempotent', () => {
  const a = action('graft cold start');
  const once = applyActions(OPEN, [a]);
  const twice = applyActions(once.text, [a]);
  assert.equal(twice.text, once.text);
  assert.deepEqual(twice.recorded, [a]);
  assert.deepEqual(twice.appended, []);
});

test('applyActions holds P0 and P1 actions for Tier 1 and leaves the text alone', () => {
  const high = action('needs approval', { severity: 'high' });
  const result = applyActions(OPEN, [high]);
  assert.equal(result.text, OPEN);
  assert.deepEqual(result.pending, [high]);
});

test('applyActions appends to an Open section that is last in the file', () => {
  const a = action('tail section');
  const result = applyActions('## Open\n\n- [ ] one\n', [a]);
  assert.equal(result.text, `## Open\n\n- [ ] one\n${renderTodoLine(a)}\n`);
});

test('applyActions preserves CRLF line endings', () => {
  const a = action('crlf file');
  const crlf = OPEN.replace(/\n/g, '\r\n');
  const { text } = applyActions(crlf, [a]);
  assert.ok(!/(?<!\r)\n/.test(text), 'every newline stays CRLF');
  assert.ok(text.includes(renderTodoLine(a)));
});

test('applyActions throws when TODOS.md has no Open section', () => {
  assert.throws(() => applyActions('# TODOS\n', [action('x')]), /no "## Open" section/);
});

test('applyActions without appendable actions does not require an Open section', () => {
  assert.equal(applyActions('# TODOS\n', [action('x', { severity: 'high' })]).text, '# TODOS\n');
});

test('consolidate writes the file and a dry run does not', () => {
  const files = { 'claude/2026-10-17-a.json': entry([finding('write me')]) };
  withWorkspace(files, OPEN, ({ inbox, todosFile }) => {
    const dry = consolidate({ inboxDir: inbox, todosFile, dryRun: true });
    assert.equal(dry.appended.length, 1);
    assert.equal(readFileSync(todosFile, 'utf8'), OPEN);
    consolidate({ inboxDir: inbox, todosFile });
    assert.match(readFileSync(todosFile, 'utf8'), /write me/);
  });
});

test('consolidate refuses an invalid inbox and leaves TODOS.md untouched', () => {
  const files = { 'claude/2026-10-17-bad.json': { schema: 'wrong' } };
  withWorkspace(files, OPEN, ({ inbox, todosFile }) => {
    const result = consolidate({ inboxDir: inbox, todosFile });
    assert.equal(result.ok, false);
    assert.ok(result.errors.length > 0);
    assert.equal(readFileSync(todosFile, 'utf8'), OPEN);
  });
});

test('CLI appends, reports counts, and a second run is a no-op', () => {
  const files = {
    'claude/2026-10-17-a.json': entry([finding('low one'), finding('high one', { severity: 'high' })]),
  };
  withWorkspace(files, OPEN, ({ inbox, todosFile }) => {
    const first = runCli(['--inbox', inbox, '--todos', todosFile]);
    assert.equal(first.status, 0, first.stderr);
    assert.match(first.stdout, /appended 1, 1 awaiting Tier 1, 0 already recorded/);
    const after = readFileSync(todosFile, 'utf8');
    const second = runCli(['--inbox', inbox, '--todos', todosFile]);
    assert.match(second.stdout, /appended 0, 1 awaiting Tier 1, 1 already recorded/);
    assert.equal(readFileSync(todosFile, 'utf8'), after);
  });
});

test('CLI exits 2 on unknown flags', () => {
  const result = runCli(['--bogus']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /usage:/);
});

test('CLI exits 1 when TODOS.md is missing', () => {
  withWorkspace({}, null, ({ inbox, todosFile }) => {
    const result = runCli(['--inbox', inbox, '--todos', todosFile]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /does not exist/);
  });
});

test('CLI exits 1 and lists errors for an invalid inbox', () => {
  withWorkspace({ 'claude/2026-10-17-bad.json': { schema: 'wrong' } }, OPEN, ({ inbox, todosFile }) => {
    const result = runCli(['--inbox', inbox, '--todos', todosFile]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /inbox invalid/);
  });
});
