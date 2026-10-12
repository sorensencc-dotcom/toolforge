import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const skill = new URL('../', import.meta.url);
const json = async url => JSON.parse(await readFile(url, 'utf8'));

test('initial deployed migration matches transaction-tested schema', async () => {
  const schema = (await readFile(new URL('sql/001-research-store.sql', skill), 'utf8')).replace(/\r\n/g, '\n').trim();
  const migration = (await readFile(new URL('../../supabase/migrations/20261011000124_research_store.sql', skill), 'utf8')).replace(/\r\n/g, '\n').trim();
  assert.equal(migration, `SET search_path = public, extensions;\nGRANT USAGE ON SCHEMA public, extensions TO authenticated, service_role;\n${schema}\nNOTIFY pgrst, 'reload schema';`);
});

test('package declares all runtime dependencies including js-yaml', async () => {
  const pkg = await json(new URL('package.json', skill));
  assert.equal(pkg.type, 'module');
  for (const name of ['@modelcontextprotocol/sdk', '@supabase/supabase-js', 'openai', 'js-yaml']) {
    assert.ok(pkg.dependencies[name], `missing declared dependency: ${name}`);
  }
});

test('manifest registers exactly one research-store executable', async () => {
  const metadata = await json(new URL('skill.json', skill));
  const manifest = await json(new URL('../../manifest.json', skill));
  const matches = manifest.skills.filter(row => row.id === 'research-store');
  assert.equal(matches.length, 1);
  assert.equal(metadata.id, 'research-store');
  assert.equal(metadata.entrypoint, 'src/mcp-server.mjs');
  assert.equal(matches[0].entrypoint, 'skills/research-store/src/mcp-server.mjs');
  await access(new URL(metadata.entrypoint, skill));
});

test('one malformed file makes sync CLI fail instead of reporting success', async () => {
  const script = new URL('src/sync.mjs', skill);
  await access(script);
  const root = await mkdtemp(join(tmpdir(), 'research-cli-test-'));
  try {
    await writeFile(join(root, 'invalid.md'), '---\ntitle: [\n---\nBody');
    const result = spawnSync(process.execPath, [fileURLToPath(script), '--dry-run'], {
      env: { SystemRoot: process.env.SystemRoot, RESEARCH_ROOT: root }, encoding: 'utf8', timeout: 5000,
    });
    assert.ifError(result.error);
    assert.equal(result.status, 1);
    assert.doesNotMatch(result.stderr, /ERR_MODULE_NOT_FOUND|Cannot find module|OPENAI_API_KEY required/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('MCP startup never falls back to writer credentials when reader JWT missing', async () => {
  const script = new URL('src/mcp-server.mjs', skill);
  await access(script);
  const result = spawnSync(process.execPath, [fileURLToPath(script)], {
    env: {
      SystemRoot: process.env.SystemRoot,
      SUPABASE_URL: 'http://127.0.0.1:1',
      SUPABASE_SERVICE_ROLE_KEY: ['synthetic', 'writer', 'fixture'].join('-'),
    }, encoding: 'utf8', timeout: 5000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /SUPABASE_READER_JWT/);
});

test('sync CLI fails invalid project without cloud credentials', async () => {
  const script = new URL('src/sync.mjs', skill);
  await access(script);
  const result = spawnSync(process.execPath, [fileURLToPath(script), '--dry-run', '--project', 'unsupported'], {
    env: { SystemRoot: process.env.SystemRoot }, encoding: 'utf8', timeout: 5000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /project/i);
  assert.doesNotMatch(result.stderr, /ERR_MODULE_NOT_FOUND|Cannot find module/);
});
