import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const load = () => import('../src/file-sync.mjs');
async function fixture(run) {
  const root = await mkdtemp(path.join(tmpdir(), 'research-originals-'));
  try { return await run(root); } finally { await rm(root, { recursive: true, force: true }); }
}

test('DEV/UAT guard rejects production and noncanonical URL', async () => {
  const { assertFileDestination } = await load();
  assert.doesNotThrow(() => assertFileDestination('https://bhezixgmkhpndmezgsxk.supabase.co'));
  for (const url of ['https://vbyfacretnyeptlilrfm.supabase.co', 'http://bhezixgmkhpndmezgsxk.supabase.co', 'https://bhezixgmkhpndmezgsxk.supabase.co/path']) {
    assert.throws(() => assertFileDestination(url), /DEV\/UAT/);
  }
});

test('all-file capture preserves bytes, ignores lifecycle frontmatter, and needs no embedder', async () => fixture(async root => {
  const { scanOriginals } = await load();
  await writeFile(path.join(root, 'doc.md'), '---\nstatus: active\n---\n# Full original\n');
  await writeFile(path.join(root, 'image.png'), Buffer.from([137, 80, 78, 71, 0, 255]));
  const result = await scanOriginals([{ id: 'test', root }]);
  assert.equal(result.entries.length, 2);
  assert.equal(result.blocked.length, 0);
  assert.equal(result.entries.find(row => row.relative_path === 'doc.md').text_content, await readFile(path.join(root, 'doc.md'), 'utf8'));
  assert.equal(result.entries.find(row => row.relative_path === 'image.png').text_content, null);
}));

test('generated files, secret patterns, pointers, and archives are explicit exclusions', async () => fixture(async root => {
  const { scanOriginals } = await load();
  await mkdir(path.join(root, 'node_modules'));
  await writeFile(path.join(root, 'node_modules', 'generated.txt'), 'ignored');
  await writeFile(path.join(root, '.env'), 'private');
  await writeFile(path.join(root, 'secret.txt'), '-----BEGIN ' + 'PRIVATE KEY-----\nnever upload');
  await writeFile(path.join(root, 'pointer.gdoc'), '{}');
  await writeFile(path.join(root, 'backup.gz'), 'opaque');
  const result = await scanOriginals([{ id: 'test', root }]);
  assert.equal(result.entries.length, 0);
  assert.ok(result.blocked.some(row => row.reason === 'secret-content'));
  assert.ok(result.blocked.some(row => row.reason === 'google-export-required'));
  assert.ok(result.blocked.some(row => row.reason === 'opaque-container-review'));
  assert.doesNotMatch(JSON.stringify(result), /never upload/);
}));

test('Git provenance matches HEAD only when actual file bytes match the committed blob', async () => fixture(async root => {
  const { scanOriginals } = await load();
  const git = args => execFileSync('git', ['-c', 'core.fsmonitor=false', '-C', root, ...args], { timeout: 10000, encoding: 'utf8' });
  git(['init']);
  await writeFile(path.join(root, 'doc.txt'), 'committed\n');
  git(['add', 'doc.txt']);
  git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'fixture']);
  const head = git(['rev-parse', 'HEAD']).trim();
  let result = await scanOriginals([{ id: 'test', root, gitRoot: root, gitOnly: true }]);
  assert.equal(result.entries[0].git_sha, head);
  await writeFile(path.join(root, 'doc.txt'), 'working tree edit\n');
  await writeFile(path.join(root, 'untracked.txt'), 'not committed');
  result = await scanOriginals([{ id: 'test', root, gitRoot: root, gitOnly: true }]);
  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0].git_sha, null);
  assert.equal(result.entries[0].git_state, 'modified');
}));

test('import is repeat-safe, uploads before catalog write, and never deletes missing paths', async () => {
  const { publishOriginals } = await load();
  const state = new Map(), calls = [];
  const store = {
    existing: async row => state.get(row.relative_path),
    upload: async row => { calls.push('upload'); },
    save: async row => { calls.push('save'); state.set(row.relative_path, row); },
  };
  const entry = { source_key: 'test', relative_path: 'one.txt', content_hash: 'a'.repeat(64), byte_size: 3, storage_key: 'test/hash', git_sha: null, git_state: 'untracked' };
  assert.equal((await publishOriginals([entry], store)).stored, 1);
  assert.deepEqual(calls, ['upload', 'save']);
  assert.equal((await publishOriginals([entry], store)).unchanged, 1);
  assert.equal((await publishOriginals([], store)).stored, 0);
  assert.equal(state.size, 1);
  await assert.rejects(publishOriginals([{ ...entry, content_hash: 'b'.repeat(64) }], { ...store, upload: async () => { throw new Error('failed upload'); } }), /failed upload/);
  assert.equal(state.get('one.txt').content_hash, entry.content_hash);
});

test('migration uses service-only catalog access with no embedding requirement', async () => {
  const sql = await readFile(new URL('../sql/003-original-files.sql', import.meta.url), 'utf8');
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /REVOKE ALL.*authenticated/s);
  assert.match(sql, /GRANT SELECT, INSERT, UPDATE ON.*service_role/s);
  assert.doesNotMatch(sql, /vector\(|embedding|DROP TABLE/i);
  const migration = await readFile(new URL('../../../supabase/migrations/20261013000124_research_original_files.sql', import.meta.url), 'utf8');
  assert.equal(migration.replace(/\r\n/g, '\n').trim(), `SET search_path = public, extensions;\n${sql.replace(/\r\n/g, '\n').trim()}\nNOTIFY pgrst, 'reload schema';`);
});

test('immutable staging survives source edit and total budgets prevent further capture', async () => fixture(async root => {
  const { scanOriginals } = await load();
  const source = path.join(root, 'source'), staging = path.join(root, 'stage');
  await mkdir(source); await mkdir(staging);
  await writeFile(path.join(source, 'one.txt'), 'original');
  await writeFile(path.join(source, 'two.txt'), 'second');
  const result = await scanOriginals([{ id: 'test', root: source }], { stagingRoot: staging, maxTotalBytes: 8 });
  assert.equal(result.entries.length, 1);
  assert.ok(result.blocked.some(row => row.reason === 'over-total-budget'));
  await writeFile(path.join(source, 'one.txt'), 'changed');
  assert.equal(await readFile(result.entries[0].stagedPath, 'utf8'), 'original');
}));
