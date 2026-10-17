import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  INBOX_REGISTRY,
  INBOX_SCHEMA,
  computeFindingId,
  validateEntry,
  validateInbox,
} from '../scripts/validate-retro-inbox.mjs';

const SCRIPT = fileURLToPath(new URL('../scripts/validate-retro-inbox.mjs', import.meta.url));
const SCHEMA_FILE = new URL('../docs/meta/governance/schemas/retro-inbox-v1.schema.json', import.meta.url);
const ENTRY_PATH = join('repo', '.context', 'retros', 'inbox', 'claude', '2026-10-17-graft-cold-start.json');
const SUMMARY = 'graft MCP server times out on cold start';
// Derived outside the code under test with printf 'toolforge\nmcp\ngraft mcp server times out on cold start' | sha256sum
const SUMMARY_ID = 'RF-67037cac182c';

function finding(overrides = {}) {
  const fields = { tag: 'MCP', severity: 'medium', summary: SUMMARY, evidence: ['logs/graft-mcp.log:12'], ...overrides };
  return { id: computeFindingId({ repo: 'toolforge', tag: fields.tag, summary: fields.summary }), ...fields };
}

function entry(overrides = {}) {
  return { schema: 'retro-inbox/1', agent: 'claude', repo: 'toolforge', date: '2026-10-17', findings: [finding()], ...overrides };
}

function withInbox(files, run) {
  const repo = mkdtempSync(join(tmpdir(), 'retro-inbox-'));
  const inbox = join(repo, '.context', 'retros', 'inbox');
  mkdirSync(inbox, { recursive: true });
  try {
    for (const [relative, content] of Object.entries(files)) {
      const file = join(inbox, relative);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
    }
    return run(inbox);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
}

function assertSingleError({ ok, errors }, prefix) {
  assert.equal(ok, false);
  assert.equal(errors.length, 1, errors.join('\n'));
  assert.ok(errors[0].startsWith(prefix), errors[0]);
}

function runCli(args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', timeout: 30000 });
}

test('computeFindingId follows the spec algorithm', () => {
  assert.equal(computeFindingId({ repo: 'toolforge', tag: 'MCP', summary: SUMMARY }), SUMMARY_ID);
});

test('computeFindingId ignores whitespace and case changes', () => {
  const noisy = { repo: '  Toolforge ', tag: 'mcp', summary: ' Graft  MCP server\ttimes out\non COLD start  ' };
  assert.equal(computeFindingId(noisy), SUMMARY_ID);
});

test('computeFindingId differs across repo, tag, summary, and field boundaries', () => {
  const ids = [
    { repo: 'toolforge', tag: 'MCP', summary: SUMMARY },
    { repo: 'sigil', tag: 'MCP', summary: SUMMARY },
    { repo: 'toolforge', tag: 'TOOLING', summary: SUMMARY },
    { repo: 'toolforge', tag: 'MCP', summary: `${SUMMARY} again` },
    { repo: 'tool', tag: 'forge MCP', summary: SUMMARY },
  ].map(computeFindingId);
  assert.equal(new Set(ids).size, ids.length);
});

test('computeFindingId rejects non-string input', () => {
  assert.throws(() => computeFindingId({ repo: 'toolforge', tag: 'MCP' }), TypeError);
});

test('validateEntry accepts a complete entry at its inbox path', () => {
  const complete = entry({ session: 'feat/retro-governance', findings: [finding({ suggestion: 'warm the index first' })] });
  assert.deepEqual(validateEntry(complete, ENTRY_PATH), { ok: true, errors: [] });
});

const REJECTIONS = [
  ['a missing required field', (e) => { delete e.findings; }, 'findings: '],
  ['an unknown field', (e) => { e.notes = 'scratch'; }, 'notes: '],
  ['another schema version', (e) => { e.schema = 'retro-inbox/2'; }, 'schema: '],
  ['an unregistered agent', (e) => { e.agent = 'chatgpt'; }, 'agent: '],
  ['an unregistered tag', (e) => { e.findings[0].tag = 'NETWORK'; }, 'findings[0].tag: '],
  ['an unregistered severity', (e) => { e.findings[0].severity = 'urgent'; }, 'findings[0].severity: '],
  ['a finding without evidence', (e) => { e.findings[0].evidence = []; }, 'findings[0].evidence: '],
  ['a multi-line summary', (e) => { e.findings[0].summary = 'first line\nsecond line'; }, 'findings[0].summary: '],
  ['an impossible calendar date', (e) => { e.date = '2026-02-30'; }, 'date: '],
  ['an id not computed from the finding', (e) => { e.findings[0].id = 'RF-000000000000'; }, 'findings[0].id: '],
  ['a repeated finding', (e) => { e.findings.push(structuredClone(e.findings[0])); }, 'findings[1].id: '],
];

for (const [name, mutate, prefix] of REJECTIONS) {
  test(`validateEntry rejects ${name}`, () => {
    const candidate = entry();
    mutate(candidate);
    assertSingleError(validateEntry(candidate), prefix);
  });
}

test('validateEntry names the computed id when the id is wrong', () => {
  const { errors } = validateEntry(entry({ findings: [finding({ id: 'RF-000000000000' })] }));
  assert.match(errors[0], new RegExp(SUMMARY_ID));
});

test('validateEntry rejects a file outside .context/retros/inbox', () => {
  assertSingleError(validateEntry(entry(), join('repo', 'logs', 'retro', 'claude', '2026-10-17-graft-cold-start.json')), 'path: ');
});

test('validateEntry rejects an entry filed under another agent directory', () => {
  assertSingleError(validateEntry(entry({ agent: 'codex' }), ENTRY_PATH), 'path: ');
});

test('validateEntry rejects a file name date that differs from the entry date', () => {
  assertSingleError(validateEntry(entry({ date: '2026-10-16' }), ENTRY_PATH), 'path: ');
});

test('validateEntry rejects files outside an agent directory or with a bad name', () => {
  const inbox = join('repo', '.context', 'retros', 'inbox');
  assertSingleError(validateEntry(entry(), join(inbox, '2026-10-17-graft-cold-start.json')), 'path: ');
  assertSingleError(validateEntry(entry(), join(inbox, 'claude', 'old', '2026-10-17-graft-cold-start.json')), 'path: ');
  assertSingleError(validateEntry(entry(), join(inbox, 'claude', '2026-10-17_Graft.json')), 'path: ');
});

test('validateInbox accepts a valid inbox and lists its entries', () => {
  const codex = entry({ agent: 'codex', date: '2026-10-16', findings: [finding({ tag: 'CI', summary: 'CI cache misses on every run' })] });
  withInbox({
    'claude/2026-10-17-graft-cold-start.json': entry(),
    'codex/2026-10-16-ci-cache-miss.json': codex,
  }, (inbox) => {
    const { ok, errors, entries } = validateInbox(inbox);
    assert.deepEqual(errors, []);
    assert.equal(ok, true);
    assert.deepEqual(entries.map(({ path }) => path), [
      '.context/retros/inbox/claude/2026-10-17-graft-cold-start.json',
      '.context/retros/inbox/codex/2026-10-16-ci-cache-miss.json',
    ]);
  });
});

test('validateInbox rejects the same finding filed by two agents', () => {
  withInbox({
    'claude/2026-10-17-graft-cold-start.json': entry(),
    'codex/2026-10-17-graft-cold-start.json': entry({ agent: 'codex' }),
  }, (inbox) => {
    assertSingleError(validateInbox(inbox), '.context/retros/inbox/codex/2026-10-17-graft-cold-start.json: findings[0].id: ');
  });
});

test('validateInbox reports unreadable and stray files by path', () => {
  withInbox({
    'claude/2026-10-17-broken.json': '{ "schema": ',
    'claude/2026-10-17-bom.json': `﻿${JSON.stringify(entry())}`,
    'notes.md': '# scratch',
  }, (inbox) => {
    const { ok, errors } = validateInbox(inbox);
    assert.equal(ok, false);
    for (const prefix of [
      '.context/retros/inbox/claude/2026-10-17-broken.json: file: ',
      '.context/retros/inbox/claude/2026-10-17-bom.json: file: ',
      '.context/retros/inbox/notes.md: path: ',
    ]) {
      assert.ok(errors.some((error) => error.startsWith(prefix)), `${prefix}\n${errors.join('\n')}`);
    }
  });
});

test('validateInbox accepts an empty inbox', () => {
  withInbox({}, (inbox) => assert.deepEqual(validateInbox(inbox), { ok: true, errors: [], entries: [] }));
});

test('validateInbox requires an existing .context/retros/inbox directory', () => {
  withInbox({}, (inbox) => {
    assert.equal(validateInbox(dirname(inbox)).ok, false);
    assert.equal(validateInbox(join(inbox, 'missing', '.context', 'retros', 'inbox')).ok, false);
  });
});

test('committed schema enums match the registry', () => {
  const committed = JSON.parse(readFileSync(SCHEMA_FILE, 'utf8'));
  const findingFields = committed.properties.findings.items.properties;
  assert.equal(committed.properties.schema.const, INBOX_REGISTRY.schema);
  assert.deepEqual(committed.properties.agent.enum, INBOX_REGISTRY.agents);
  assert.deepEqual(findingFields.tag.enum, Object.keys(INBOX_REGISTRY.tags));
  assert.deepEqual(findingFields.severity.enum, Object.keys(INBOX_REGISTRY.severities));
});

test('committed schema matches the generated schema', () => {
  const committed = JSON.parse(readFileSync(SCHEMA_FILE, 'utf8'));
  assert.deepEqual(committed, INBOX_SCHEMA, 'schema drifted; run node scripts/validate-retro-inbox.mjs --write-schema');
});

test('severity sets TODOS priority and the append rule', () => {
  const disposition = Object.fromEntries(Object.entries(INBOX_REGISTRY.severities).map(([severity, { priority }]) => [
    severity,
    `${priority} ${INBOX_REGISTRY.priorities[priority].todosAppend}`,
  ]));
  assert.deepEqual(disposition, { critical: 'P0 approval', high: 'P1 approval', medium: 'P2 auto', low: 'P2 auto' });
});

test('every tag maps to an ICF launch category', () => {
  // Mirrors LAUNCH_CATEGORY_IDS in icf/reporting/src/category-contract.mjs, a separate repo.
  const launchCategories = ['delivery', 'quality', 'reliability', 'governance'];
  for (const [tag, { icfCategory }] of Object.entries(INBOX_REGISTRY.tags)) {
    assert.ok(launchCategories.includes(icfCategory), `${tag} maps to ${icfCategory}`);
  }
});

test('CLI exits 0 and summarizes a valid inbox', () => {
  withInbox({ 'claude/2026-10-17-graft-cold-start.json': entry() }, (inbox) => {
    const { status, stdout } = runCli([inbox]);
    assert.equal(status, 0);
    assert.match(stdout, /retro inbox valid: 1 file, 1 finding/);
  });
});

test('CLI exits 1 and lists each error with its file', () => {
  withInbox({ 'claude/2026-10-17-graft-cold-start.json': entry({ agent: 'codex' }) }, (inbox) => {
    const { status, stderr } = runCli([inbox]);
    assert.equal(status, 1);
    assert.match(stderr, /\.context\/retros\/inbox\/claude\/2026-10-17-graft-cold-start\.json: path: /);
  });
});

test('CLI exits 2 on an unknown option', () => {
  assert.equal(runCli(['--strict']).status, 2);
});
