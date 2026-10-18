import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { computeFindingId, validateEntry, validateInbox } from '../scripts/validate-retro-inbox.mjs';
import { configErrors, recommendationFindings } from '../scripts/harvest-retro-inbox.mjs';

const SCRIPT = fileURLToPath(new URL('../scripts/harvest-retro-inbox.mjs', import.meta.url));
const COMMITTED_CONFIG = new URL('../.context/retros/harvest/config.json', import.meta.url);
const SIGIL_ENTRY = '.context/retros/inbox/ci/2026-10-16-sigil-retro-1.json';
const HARNESS = 'Automate an integration harness for multi-turn web room sessions.';
const TRANSACTION = 'Wrap mutation and audit-event writes in one Postgres transaction.';

function withWorkspace(run) {
  const base = mkdtempSync(join(tmpdir(), 'retro-harvest-'));
  const ws = { root: join(base, 'root'), repo: (name) => join(base, 'repos', name), configFile: join(base, 'config.json') };
  mkdirSync(ws.root, { recursive: true });
  try {
    return run(ws);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
}

function writeFile(file, content) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
}

function writeRetro(ws, repoDir, name, recommendations) {
  const content = Array.isArray(recommendations) || typeof recommendations !== 'string'
    ? { date: name.slice(0, 10), window: '7d', metrics: { commits: 1 }, recommendations }
    : recommendations;
  writeFile(join(ws.repo(repoDir), '.context', 'retros', name), content);
}

function sigilConfig(ws, overrides = {}) {
  return { repos: [{ repo: 'sigil', path: ws.repo('sigil-repo') }], severity: 'low', categoryTags: { testing: 'TEST' }, ...overrides };
}

function harvest(ws, { config = sigilConfig(ws), args = [] } = {}) {
  writeFile(ws.configFile, config);
  return spawnSync(process.execPath, [SCRIPT, '--config', ws.configFile, ...args], { cwd: ws.root, encoding: 'utf8', timeout: 30000 });
}

function inboxDir(ws) {
  return join(ws.root, '.context', 'retros', 'inbox');
}

function snapshot(ws) {
  const files = {};
  const walk = (dir) => {
    if (!existsSync(dir)) return;
    for (const dirent of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, dirent.name);
      if (dirent.isDirectory()) walk(full);
      else files[relative(ws.root, full).replaceAll('\\', '/')] = readFileSync(full, 'utf8');
    }
  };
  walk(join(ws.root, '.context'));
  return files;
}

function readJson(ws, file) {
  return JSON.parse(readFileSync(join(ws.root, file), 'utf8'));
}

function ledger(ws) {
  const file = join(ws.root, '.context', 'retros', 'harvest', 'ledger.jsonl');
  return existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line)) : [];
}

const testId = (repo, summary) => computeFindingId({ repo, tag: 'TEST', summary });

test('files tagged recommendations as one valid ci entry per retro and records each in the ledger', () => {
  withWorkspace((ws) => {
    writeRetro(ws, 'sigil-repo', '2026-10-16-1.json', [
      { category: 'testing', text: HARNESS },
      { category: 'Tooling', text: TRANSACTION },
    ]);
    const { status, stdout, stderr } = harvest(ws);
    assert.equal(status, 0, stderr);
    assert.match(stdout, /wrote 2 new findings in 1 entry/);
    const pointer = (index) => `.context/retros/2026-10-16-1.json#/recommendations/${index}`;
    assert.deepEqual(readJson(ws, SIGIL_ENTRY), {
      schema: 'retro-inbox/1',
      agent: 'ci',
      repo: 'sigil',
      date: '2026-10-16',
      session: '.context/retros/2026-10-16-1.json',
      findings: [
        { id: testId('sigil', HARNESS), tag: 'TEST', severity: 'low', summary: HARNESS, evidence: [pointer(0)], suggestion: HARNESS },
        {
          id: computeFindingId({ repo: 'sigil', tag: 'TOOLING', summary: TRANSACTION }),
          tag: 'TOOLING',
          severity: 'low',
          summary: TRANSACTION,
          evidence: [pointer(1)],
          suggestion: TRANSACTION,
        },
      ],
    });
    assert.deepEqual(validateInbox(inboxDir(ws)).errors, []);
    const records = ledger(ws);
    assert.deepEqual(records.map(({ id, repo, source, entry }) => ({ id, repo, source, entry })), [
      { id: testId('sigil', HARNESS), repo: 'sigil', source: pointer(0), entry: SIGIL_ENTRY },
      { id: computeFindingId({ repo: 'sigil', tag: 'TOOLING', summary: TRANSACTION }), repo: 'sigil', source: pointer(1), entry: SIGIL_ENTRY },
    ]);
    assert.ok(records.every(({ harvestedAt }) => !Number.isNaN(Date.parse(harvestedAt))), JSON.stringify(records));
  });
});

test('a second run writes nothing new', () => {
  withWorkspace((ws) => {
    writeRetro(ws, 'sigil-repo', '2026-10-16-1.json', [{ category: 'testing', text: HARNESS }]);
    assert.equal(harvest(ws).status, 0);
    const before = snapshot(ws);
    const second = harvest(ws);
    assert.equal(second.status, 0, second.stderr);
    assert.deepEqual(snapshot(ws), before);
    assert.match(second.stdout, /wrote 0 new findings in 0 entries, 1 already recorded/);
  });
});

test('dry run reports the entries it would write and writes nothing', () => {
  withWorkspace((ws) => {
    writeRetro(ws, 'sigil-repo', '2026-10-16-1.json', [{ category: 'testing', text: HARNESS }]);
    const { status, stdout } = harvest(ws, { args: ['--dry-run'] });
    assert.equal(status, 0);
    assert.match(stdout, new RegExp(`would write ${SIGIL_ENTRY.replaceAll('.', '\\.')}`));
    assert.match(stdout, /would write 1 new finding in 1 entry/);
    assert.deepEqual(snapshot(ws), {});
  });
});

test('skips a finding another agent already filed in the inbox', () => {
  withWorkspace((ws) => {
    writeRetro(ws, 'sigil-repo', '2026-10-16-1.json', [
      { category: 'testing', text: HARNESS },
      { category: 'testing', text: TRANSACTION },
    ]);
    writeFile(join(inboxDir(ws), 'claude', '2026-10-16-room-harness.json'), {
      schema: 'retro-inbox/1',
      agent: 'claude',
      repo: 'sigil',
      date: '2026-10-16',
      findings: [{ id: testId('sigil', HARNESS), tag: 'TEST', severity: 'medium', summary: HARNESS, evidence: ['sigil/web/room.test.mjs:40'] }],
    });
    assert.equal(harvest(ws).status, 0);
    assert.deepEqual(readJson(ws, SIGIL_ENTRY).findings.map(({ summary }) => summary), [TRANSACTION]);
    assert.deepEqual(validateInbox(inboxDir(ws)).errors, []);
  });
});

test('never refiles a harvested finding after its entry leaves the inbox', () => {
  withWorkspace((ws) => {
    writeRetro(ws, 'sigil-repo', '2026-10-16-1.json', [{ category: 'testing', text: HARNESS }]);
    assert.equal(harvest(ws).status, 0);
    rmSync(inboxDir(ws), { recursive: true });
    writeRetro(ws, 'sigil-repo', '2026-10-17-1.json', [{ category: 'testing', text: HARNESS }]);
    const { status, stdout } = harvest(ws);
    assert.equal(status, 0);
    assert.equal(existsSync(inboxDir(ws)), false);
    assert.match(stdout, /wrote 0 new findings in 0 entries, 2 already recorded/);
  });
});

test('remapping a category never refiles a harvested recommendation', () => {
  withWorkspace((ws) => {
    writeRetro(ws, 'sigil-repo', '2026-10-16-1.json', [{ category: 'hygiene', text: HARNESS }]);
    assert.equal(harvest(ws, { config: sigilConfig(ws, { categoryTags: { hygiene: 'PROCESS' } }) }).status, 0);
    const before = snapshot(ws);
    const { status, stdout } = harvest(ws, { config: sigilConfig(ws, { categoryTags: { hygiene: 'TOOLING' } }) });
    assert.equal(status, 0);
    assert.deepEqual(snapshot(ws), before);
    assert.match(stdout, /1 already recorded/);
  });
});

test('leaves an unmapped category unharvested until the config maps it', () => {
  withWorkspace((ws) => {
    writeRetro(ws, 'sigil-repo', '2026-10-16-1.json', [{ category: 'ergonomics', text: TRANSACTION }]);
    const first = harvest(ws);
    assert.equal(first.status, 0);
    assert.match(first.stderr, /recommendations\/0: category "ergonomics" names no tag/);
    assert.deepEqual(snapshot(ws), {});
    const second = harvest(ws, { config: sigilConfig(ws, { categoryTags: { ergonomics: 'TOOLING' } }) });
    assert.equal(second.status, 0, second.stderr);
    assert.deepEqual(readJson(ws, SIGIL_ENTRY).findings.map(({ tag, summary }) => [tag, summary]), [['TOOLING', TRANSACTION]]);
  });
});

test('skips a missing repository with a warning and harvests the others', () => {
  withWorkspace((ws) => {
    writeRetro(ws, 'sigil-repo', '2026-10-16-1.json', [{ category: 'testing', text: HARNESS }]);
    mkdirSync(ws.repo('cic-ingestion'), { recursive: true });
    const repos = [
      { repo: 'toolforge', path: ws.repo('toolforge') },
      { repo: 'cic-ingestion', path: ws.repo('cic-ingestion') },
      { repo: 'sigil', path: ws.repo('sigil-repo') },
    ];
    const { status, stdout, stderr } = harvest(ws, { config: sigilConfig(ws, { repos }) });
    assert.equal(status, 0, stderr);
    assert.match(stderr, /warning: toolforge \(.+\): repository directory not found, skipped/);
    assert.match(stdout, /cic-ingestion \(.+\): no \.context\/retros directory/);
    assert.equal(readJson(ws, SIGIL_ENTRY).findings.length, 1);
  });
});

test('tolerates unreadable retros and malformed recommendations', () => {
  withWorkspace((ws) => {
    writeRetro(ws, 'sigil-repo', '2026-10-14-1.json', '{ "date": ');
    writeRetro(ws, 'sigil-repo', '2026-10-15-1.json', { date: '2026-10-15', recommendations: 'pair merges with tests' });
    writeRetro(ws, 'sigil-repo', '2026-10-16-1.json', [
      'pair merges with tests',
      { category: 'testing' },
      { category: 'testing', text: '   ' },
      { category: 'testing', text: HARNESS },
    ]);
    const { status, stderr } = harvest(ws);
    assert.equal(status, 0, stderr);
    for (const pattern of [
      /2026-10-14-1\.json: unreadable/,
      /2026-10-15-1\.json: recommendations is not an array/,
      /2026-10-16-1\.json#\/recommendations\/0: needs a string category/,
      /2026-10-16-1\.json#\/recommendations\/1: needs a string category/,
      /2026-10-16-1\.json#\/recommendations\/2: needs a string category/,
    ]) {
      assert.match(stderr, pattern);
    }
    assert.deepEqual(readJson(ws, SIGIL_ENTRY).findings.map(({ evidence }) => evidence), [['.context/retros/2026-10-16-1.json#/recommendations/3']]);
  });
});

test('reads a retro that starts with a byte order mark', () => {
  withWorkspace((ws) => {
    const retro = { date: '2026-10-16', recommendations: [{ category: 'testing', text: HARNESS }] };
    writeRetro(ws, 'sigil-repo', '2026-10-16-1.json', `${String.fromCharCode(0xfeff)}${JSON.stringify(retro)}`);
    const { status, stderr } = harvest(ws);
    assert.equal(status, 0);
    assert.equal(stderr, '');
    assert.deepEqual(readJson(ws, SIGIL_ENTRY).findings.map(({ summary }) => summary), [HARNESS]);
  });
});

test('reads only dated retros directly under .context/retros', () => {
  withWorkspace((ws) => {
    const dated = { category: 'testing', text: HARNESS };
    writeRetro(ws, 'sigil-repo', 'session-wrap-2026-10-16.json', [dated]);
    writeRetro(ws, 'sigil-repo', '2026-10-16-1.json.backup', [dated]);
    writeFile(join(ws.repo('sigil-repo'), '.context', 'retros', 'archive', '2026-10-16-1.json'), { recommendations: [dated] });
    writeFile(join(ws.repo('sigil-repo'), 'memory', '2026-10-16-1.json'), { recommendations: [dated] });
    const { status, stdout } = harvest(ws);
    assert.equal(status, 0);
    assert.match(stdout, /0 dated retros/);
    assert.deepEqual(snapshot(ws), {});
  });
});

test('orders entries by config, then retro date and number, and files a repeated recommendation once', () => {
  withWorkspace((ws) => {
    writeRetro(ws, 'sigil-repo', '2026-10-16-10.json', [{ category: 'testing', text: HARNESS }, { category: 'testing', text: 'Tenth retro item.' }]);
    writeRetro(ws, 'sigil-repo', '2026-10-16-2.json', [{ category: 'testing', text: 'Second retro item.' }]);
    writeRetro(ws, 'sigil-repo', '2026-10-15-1.json', [{ category: 'testing', text: HARNESS }, { category: 'testing', text: HARNESS }]);
    writeRetro(ws, 'kb-sync', '2026-10-01-1.json', [{ category: 'testing', text: HARNESS }]);
    const repos = [{ repo: 'sigil', path: ws.repo('sigil-repo') }, { repo: 'kb-sync', path: ws.repo('kb-sync') }];
    const { status, stdout } = harvest(ws, { config: sigilConfig(ws, { repos }) });
    assert.equal(status, 0);
    assert.match(stdout, /wrote 4 new findings in 4 entries, 2 already recorded/);
    assert.deepEqual(ledger(ws).map(({ repo, source }) => `${repo} ${source}`), [
      'sigil .context/retros/2026-10-15-1.json#/recommendations/0',
      'sigil .context/retros/2026-10-16-2.json#/recommendations/0',
      'sigil .context/retros/2026-10-16-10.json#/recommendations/1',
      'kb-sync .context/retros/2026-10-01-1.json#/recommendations/0',
    ]);
    assert.deepEqual(validateInbox(inboxDir(ws)).errors, []);
  });
});

test('names a second entry from the same retro with a part suffix', () => {
  withWorkspace((ws) => {
    writeRetro(ws, 'sigil-repo', '2026-10-16-1.json', [
      { category: 'testing', text: HARNESS },
      { category: 'ergonomics', text: TRANSACTION },
    ]);
    assert.equal(harvest(ws).status, 0);
    assert.equal(harvest(ws, { config: sigilConfig(ws, { categoryTags: { testing: 'TEST', ergonomics: 'TOOLING' } }) }).status, 0);
    const second = readJson(ws, '.context/retros/inbox/ci/2026-10-16-sigil-retro-1-part-2.json');
    assert.deepEqual(second.findings.map(({ summary }) => summary), [TRANSACTION]);
    assert.deepEqual(validateInbox(inboxDir(ws)).errors, []);
  });
});

test('refuses to harvest into an invalid inbox', () => {
  withWorkspace((ws) => {
    writeRetro(ws, 'sigil-repo', '2026-10-16-1.json', [{ category: 'testing', text: HARNESS }]);
    writeFile(join(inboxDir(ws), 'claude', '2026-10-16-broken.json'), '{ "schema": ');
    const before = snapshot(ws);
    const { status, stderr } = harvest(ws);
    assert.equal(status, 1);
    assert.match(stderr, /error: inbox invalid, nothing harvested: .*2026-10-16-broken\.json/);
    assert.deepEqual(snapshot(ws), before);
  });
});

test('keeps a long recommendation summary to one line and the full text in the suggestion', () => {
  const text = `Split the relay bootstrap\n  ${'into smaller verified steps '.repeat(12)}before the next release.`;
  const { findings, warnings } = recommendationFindings({
    repo: 'sigil',
    source: '.context/retros/2026-10-16-1.json',
    retro: { recommendations: [{ category: 'testing', text }] },
    config: { severity: 'low', categoryTags: { testing: 'TEST' } },
  });
  assert.deepEqual(warnings, []);
  const [{ finding }] = findings;
  assert.ok([...finding.summary].length <= 200, finding.summary);
  assert.match(finding.summary, /^Split the relay bootstrap into smaller verified steps .*…$/);
  assert.equal(finding.suggestion, text);
  const entry = { schema: 'retro-inbox/1', agent: 'ci', repo: 'sigil', date: '2026-10-16', findings: [finding] };
  assert.deepEqual(validateEntry(entry, SIGIL_ENTRY), { ok: true, errors: [] });
});

test('a category that names a registered tag needs no config mapping', () => {
  const { findings } = recommendationFindings({
    repo: 'sigil',
    source: '.context/retros/2026-10-16-1.json',
    retro: { recommendations: [{ category: 'security', text: 'Rotate the relay admin token.' }] },
    config: { severity: 'low', categoryTags: {} },
  });
  assert.deepEqual(findings.map(({ finding }) => finding.tag), ['SECURITY']);
});

test('CLI exits 2 on an unknown option or an invalid config', () => {
  withWorkspace((ws) => {
    assert.equal(harvest(ws, { args: ['--strict'] }).status, 2);
    const badTag = harvest(ws, { config: sigilConfig(ws, { categoryTags: { testing: 'TESTS' } }) });
    assert.equal(badTag.status, 2);
    assert.match(badTag.stderr, /config\.categoryTags\.testing must be one of/);
    assert.equal(harvest(ws, { config: sigilConfig(ws, { severity: 'urgent' }) }).status, 2);
    assert.equal(harvest(ws, { config: sigilConfig(ws, { repos: [{ repo: 'sigil', dir: ws.repo('sigil-repo') }] }) }).status, 2);
    assert.deepEqual(snapshot(ws), {});
  });
});

test('committed config is valid', () => {
  assert.deepEqual(configErrors(JSON.parse(readFileSync(COMMITTED_CONFIG, 'utf8'))), []);
});

test('reliability recommendations map to the RELIABILITY tag with no config entry', () => {
  withWorkspace((ws) => {
    writeRetro(ws, 'sigil-repo', '2026-10-16-1.json', [{ category: 'reliability', text: TRANSACTION }]);
    assert.equal(harvest(ws).status, 0);
    assert.deepEqual(readJson(ws, SIGIL_ENTRY).findings.map(({ tag }) => tag), ['RELIABILITY']);
  });
});
