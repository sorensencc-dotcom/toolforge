import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { startFakeServices, syntheticEmbedding } from './fake-services.mjs';

const project = 'bhezixgmkhpndmezgsxk';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const run = promisify(execFile);
const check = (result, phase) => {
  if (result.error) throw new Error(`Dev/UAT ${phase} failed (details suppressed)`);
  return result.data;
};

test('persistent dev/UAT real Auth, REST, sync CLI, and MCP acceptance', { timeout: 150000 }, async () => {
  assert.equal((await readFile(join(root, 'supabase/.temp/project-ref'), 'utf8')).trim(), project);
  console.log('Dev/UAT guard passed; obtaining ephemeral credentials.');
  let stdout;
  try {
    ({ stdout } = await run('C:\\Program Files\\Git\\bin\\bash.exe', ['-lc',
      `timeout 25s npx --yes supabase projects api-keys --project-ref ${project} --reveal --output-format json`],
    { cwd: root, timeout: 27000, maxBuffer: 1024 * 1024 }));
  } catch {
    throw new Error('Dev/UAT credential lookup failed (output suppressed)');
  }
  const keys = JSON.parse(stdout).keys;
  const anon = keys.find(key => key.name === 'anon')?.api_key;
  const writer = keys.find(key => key.name === 'service_role')?.api_key;
  assert.ok(anon && writer, 'required dev/UAT credentials unavailable');
  const url = `https://${project}.supabase.co`;
  const options = { auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10000) }) } };
  const service = createClient(url, writer, options);
  const fake = await startFakeServices();
  const exports = await mkdtemp(join(tmpdir(), 'research-uat-'));
  const users = [];
  const claims = [];
  const readers = {};
  const clients = [];
  const note = (projectName, title, body) => `---\nproject: ${projectName}\ntitle: ${title}\nstatus: VERIFIED\n---\n${body}`;
  const env = { SystemRoot: process.env.SystemRoot, ...fake.env, SUPABASE_URL: url,
    SUPABASE_SERVICE_ROLE_KEY: writer, SUPABASE_ANON_KEY: anon, RESEARCH_ROOT: exports };
  const sync = () => run(process.execPath, [fileURLToPath(new URL('../src/sync.mjs', import.meta.url))], { env, timeout: 15000 });
  const rows = async (table, id) => check(await service.from(table).select('*').eq('document_id', id), table);
  try {
    console.log('Provisioning dedicated signed test identities (no email delivery).');
    for (const [name, app_metadata, user_metadata] of [
      ['CIC', { project: 'CIC' }, {}], ['RewriteLabs', { project: 'RewriteLabs' }, {}],
      ['admin', { research_admin: true }, {}], ['untrusted', {}, { project: 'CIC', research_admin: true }],
    ]) {
      const email = `research-uat-${randomUUID()}@example.com`;
      const password = randomUUID() + randomUUID();
      const created = check(await service.auth.admin.createUser({ email, password, email_confirm: true, app_metadata, user_metadata }), 'create identity');
      users.push(created.user.id);
      const reader = createClient(url, anon, options);
      const session = check(await reader.auth.signInWithPassword({ email, password }), 'signed login').session;
      assert.ok(session?.access_token, 'signed user token missing');
      readers[name] = { reader, token: session.access_token };
    }
    console.log('Ingesting synthetic baseline through real writer API and sync CLI.');
    await mkdir(join(exports, 'uat124'));
    const cicFile = join(exports, 'uat124/cic.md');
    await writeFile(cicFile, note('CIC', 'UAT CIC', 'UAT first.\n\nUAT second.'));
    await writeFile(join(exports, 'uat124/rewrite.md'), note('RewriteLabs', 'UAT Rewrite', 'UAT rewrite.'));
    assert.equal(JSON.parse((await sync()).stderr).processed, 2);
    const docs = check(await service.from('documents').select('*').in('git_path', ['uat124/cic.md', 'uat124/rewrite.md']), 'baseline read');
    assert.equal(docs.length, 2);
    const cic = docs.find(doc => doc.project === 'CIC');
    const rewrite = docs.find(doc => doc.project === 'RewriteLabs');
    const initial = await rows('research_items', cic.id);
    assert.equal(initial.length, 2);
    const first = initial.find(item => item.chunk_index === 0);
    await sync();
    assert.deepEqual((await rows('research_items', cic.id)).map(item => item.id).sort(), initial.map(item => item.id).sort());
    await writeFile(cicFile, note('CIC', 'UAT metadata edit', 'UAT first.\n\nUAT second.'));
    await sync();
    assert.equal(check(await service.from('documents').select('title').eq('id', cic.id).single(), 'metadata read').title, 'UAT metadata edit');
    const claim = check(await service.from('claims').insert({ document_id: cic.id, research_item_id: first.id,
      project: 'CIC', statement: 'Synthetic UAT evidence', status: 'VERIFIED' }).select('id').single(), 'claim fixture');
    claims.push(claim.id);
    await writeFile(cicFile, note('CIC', 'UAT shorter', 'UAT changed.'));
    await sync();
    const shorter = await rows('research_items', cic.id);
    assert.equal(shorter.length, 1);
    assert.equal(shorter[0].id, first.id);
    const reviewed = check(await service.from('claims').select('*').eq('id', claim.id).single(), 'claim invalidation');
    assert.equal(reviewed.research_item_id, null);
    assert.equal(reviewed.status, 'NEEDS_REVIEW');
    check(await service.from('claims').delete().eq('id', claim.id), 'claim fixture cleanup');
    const before = check(await service.from('documents').select('*').eq('id', cic.id).single(), 'atomic snapshot');
    const rejected = await service.rpc('replace_research_document', { p_document: { ...before, title: 'must rollback' },
      p_items: [{ project: 'CIC', content: 'bad', chunk_index: 0, embedding: Array(384).fill(1) }] });
    assert.ok(rejected.error, 'invalid dimensions must fail');
    assert.equal(check(await service.from('documents').select('title').eq('id', cic.id).single(), 'rollback read').title, before.title);
    assert.equal((await rows('research_items', cic.id))[0].content, 'UAT changed.');
    fake.state.embeddingFailure = true;
    await assert.rejects(sync(), error => error.code === 1 && JSON.parse(error.stderr).failed === 2);
    fake.state.embeddingFailure = false;
    assert.equal((await rows('research_items', cic.id))[0].content, 'UAT changed.');
    await writeFile(cicFile, note('CIC', 'UAT empty', ''));
    await sync();
    assert.equal((await rows('research_items', cic.id)).length, 0);
    await writeFile(cicFile, note('CIC', 'UAT CIC', 'UAT first.'));
    await sync();
    console.log('Checking actual signed-user RLS, write denial, and all MCP tools.');
    for (const name of ['CIC', 'RewriteLabs', 'admin', 'untrusted']) {
      const { reader, token } = readers[name];
      const visible = check(await reader.from('documents').select('id,project').in('id', [cic.id, rewrite.id]), 'reader visibility');
      assert.equal(visible.length, name === 'admin' ? 2 : name === 'untrusted' ? 0 : 1);
      if (name === 'CIC' || name === 'RewriteLabs') assert.ok(visible.every(doc => doc.project === name));
      assert.ok((await reader.rpc('replace_research_document', { p_document: {}, p_items: [] })).error);
      assert.ok((await reader.from('documents').insert({ project: 'CIC', git_path: 'forbidden.md', title: 'Forbidden', source_type: 'archive' })).error);
      if (name === 'untrusted') continue;
      const readerEnv = { SystemRoot: env.SystemRoot, OPENAI_API_KEY: env.OPENAI_API_KEY,
        OPENAI_BASE_URL: env.OPENAI_BASE_URL, SUPABASE_URL: url, SUPABASE_ANON_KEY: anon, SUPABASE_READER_JWT: token };
      const transport = new StdioClientTransport({ command: process.execPath,
        args: [fileURLToPath(new URL('../src/mcp-server.mjs', import.meta.url))], env: readerEnv, stderr: 'pipe' });
      const client = new Client({ name: 'dev-uat', version: '1.0.0' });
      clients.push(client);
      await client.connect(transport);
      assert.equal((await client.listTools()).tools.length, 3);
      const call = async (tool, args) => {
        const result = await client.callTool({ name: tool, arguments: args }, undefined, { timeout: 10000 });
        assert.notEqual(result.isError, true, `MCP ${tool} failed`);
        return JSON.parse(result.content[0].text);
      };
      const own = name === 'RewriteLabs' ? rewrite : cic;
      const query = name === 'RewriteLabs' ? 'UAT rewrite.' : 'UAT first.';
      const matches = await call('match_research_items', { query });
      assert.ok(matches.some(item => item.document_id === own.id));
      assert.ok(matches.every(item => name === 'admin' || item.project === name));
      const fetched = await call('fetch_document', { document_id: own.id, include_claims: true });
      assert.equal(fetched.document.id, own.id);
      assert.ok(Array.isArray(fetched.claims));
      const listed = await call('list_by_status', { status: 'VERIFIED', limit: 100 });
      assert.ok(listed.some(item => item.document_id === own.id));
      assert.ok(listed.every(item => name === 'admin' || item.project === name));
      if (name !== 'admin') {
        const foreign = name === 'CIC' ? rewrite.id : cic.id;
        const denied = await client.callTool({ name: 'fetch_document', arguments: { document_id: foreign } });
        const absent = await client.callTool({ name: 'fetch_document', arguments: { document_id: randomUUID() } });
        assert.deepEqual(denied, absent);
      }
      await client.close();
      clients.pop();
    }
    const raw = token => fetch(`${url}/rest/v1/rpc/match_research_items`, {
      method: 'POST', headers: { apikey: anon, ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
      body: JSON.stringify({ query_embedding: syntheticEmbedding('UAT first.') }), signal: AbortSignal.timeout(10000) });
    assert.ok(!(await raw(null)).ok, 'anonymous RPC must deny');
    const parts = readers.CIC.token.split('.');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url'));
    payload.exp = 1;
    parts[1] = Buffer.from(JSON.stringify(payload)).toString('base64url');
    assert.ok(!(await raw(parts.join('.'))).ok, 'tampered expired payload must deny');
    parts[2] = 'invalid-signature';
    assert.ok(!(await raw(parts.join('.'))).ok, 'forged signature must deny');
    console.log('Real API acceptance passed; retaining two synthetic baseline documents.');
  } finally {
    for (const client of clients) await client.close();
    let cleanupFailed = false;
    for (const id of claims) {
      try {
        if ((await service.from('claims').delete().eq('id', id)).error) cleanupFailed = true;
      } catch { cleanupFailed = true; }
    }
    for (const id of users) {
      try {
        if ((await service.auth.admin.deleteUser(id)).error) cleanupFailed = true;
      } catch { cleanupFailed = true; }
    }
    await fake.close();
    await rm(exports, { recursive: true, force: true });
    assert.equal(cleanupFailed, false, 'run-owned dev/UAT fixture cleanup failed');
    console.log('Dedicated test identities and local fixtures cleaned up.');
  }
});
