import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createEmbeddingProvider } from '../src/config.mjs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { calibrationQueries, measure, selectThreshold } from './calibration.test.mjs';
import { cleanupQualityPublications } from './helpers/quality-cleanup.mjs';

const project = 'bhezixgmkhpndmezgsxk';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const run = promisify(execFile);
const check = (result, phase) => {
  if (result.error) throw new Error(`Dev/UAT ${phase} failed (details suppressed)`);
  return result.data;
};
const corpus = [
  'A research document replacement commits atomically after every paragraph embedding validates. If embedding generation fails, the previously published document and chunks remain unchanged.',
  'A signed reader JWT grants access only to its trusted project. Expired tokens are denied by the API. Writer credentials never serve as reader fallback.',
  'A failed database enhancement rolls back its transaction. Reapply the baseline migration in an isolated schema, verify acceptance, and remove all synthetic fixture schemas.',
];
const calibration = process.env.RESEARCH_UAT_CALIBRATION === '1';
const queries = calibration ? calibrationQueries.map(row => row.query) : [
  'What happens to indexed content when vector generation fails?',
  'Can an outdated login token read another project?',
  'How should a broken schema upgrade recover?',
];
const inputs = [...corpus, corpus[0], ...queries];

test('Toolforge local multimodel embeddings and synthetic retrieval quality', { timeout: 240000 }, async () => {
  assert.equal(process.env.RESEARCH_UAT_EMBEDDING_APPROVED, '1', 'explicit synthetic dev/UAT rehearsal required');
  if (calibration) {
    assert.equal(process.env.EMBEDDING_PROVIDER || 'ollama', 'ollama', 'calibration must not consume external egress approval');
    assert.equal(process.env.EMBEDDING_MODEL, 'qwen3-embedding:4b', 'calibration pins approved local model');
  }
  const inputBytes = inputs.reduce((sum, input) => sum + Buffer.byteLength(input), 0);
  assert.ok(inputBytes <= 4096, 'single-request synthetic fixture budget exceeded');
  assert.equal((await readFile(new URL('supabase/.temp/project-ref', new URL('../../../', import.meta.url)), 'utf8')).trim(), project);
  let stdout;
  try {
    ({ stdout } = await run('C:\\Program Files\\Git\\bin\\bash.exe', ['-lc',
      `timeout 25s npx --yes supabase projects api-keys --project-ref ${project} --reveal --output-format json`],
    { cwd: root, timeout: 27000, maxBuffer: 1024 * 1024 }));
  } catch { throw new Error('Dev/UAT credential lookup failed (details suppressed)'); }
  const keys = JSON.parse(stdout).keys;
  const anon = keys.find(key => key.name === 'anon')?.api_key;
  const writer = keys.find(key => key.name === 'service_role')?.api_key;
  assert.ok(anon && writer, 'dev/UAT credentials unavailable');
  const url = `https://${project}.supabase.co`;
  const options = { auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10000) }) } };
  const service = createClient(url, writer, options);
  const ids = [];
  const exports = await mkdtemp(join(tmpdir(), 'research-local-quality-'));
  let mcp;
  let userId;
  const paths = [];
  try {
    const email = `research-quality-${randomUUID()}@example.com`;
    const password = randomUUID() + randomUUID();
    userId = check(await service.auth.admin.createUser({ email, password, email_confirm: true,
      app_metadata: { project: 'CIC' } }), 'create quality identity').user.id;
    const reader = createClient(url, anon, options);
    const session = check(await reader.auth.signInWithPassword({ email, password }), 'quality signed login').session;
    const embed = createEmbeddingProvider(process.env);
    let vectors;
    try { vectors = await embed(inputs); }
    catch { throw new Error('Selected Toolforge embedding lane unavailable (details suppressed)'); }
    if (calibration) assert.equal(embed.identity,
      'ollama:qwen3-embedding:4b@df5bd2e3c74cd8d069d21dc038f1b359fcdc9458fce1c99bd43c9eb1518ff907:1536',
      'calibration model digest drift');
    console.log(`Toolforge embedding identity ${embed.identity}: ${vectors.length} validated 1536-dimensional vectors.`);
    const namespace = `uat124-quality/${randomUUID()}`;
    await mkdir(join(exports, namespace), { recursive: true });
    for (let index = 0; index < 4; index++) {
      const scope = index === 3 ? 'RewriteLabs' : 'CIC';
      await writeFile(join(exports, namespace, `${index}.md`),
        `---\nproject: ${scope}\nstatus: VERIFIED\ntitle: Synthetic quality ${index}\n---\n${inputs[index]}`);
    }
    const embeddingEnv = { EMBEDDING_PROVIDER: process.env.EMBEDDING_PROVIDER || 'ollama',
      EMBEDDING_MODEL: process.env.EMBEDDING_MODEL,
      ...(process.env.OLLAMA_BASE_URL ? { OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL } : {}),
      ...(process.env.FREELLM_BASE_URL ? { FREELLM_BASE_URL: process.env.FREELLM_BASE_URL } : {}),
      ...(process.env.FREELLM_API_KEY ? { FREELLM_API_KEY: process.env.FREELLM_API_KEY } : {}) };
    paths.push(...inputs.slice(0, 4).map((_, index) => `${namespace}/${index}.md`));
    // Capture partial CLI publications too, so a failed run still cleans its namespace.
    try {
      const synced = await run(process.execPath, [fileURLToPath(new URL('../src/sync.mjs', import.meta.url))],
        { env: { SystemRoot: process.env.SystemRoot, ...embeddingEnv, SUPABASE_URL: url,
          SUPABASE_SERVICE_ROLE_KEY: writer, RESEARCH_ROOT: exports }, timeout: 65000 });
      assert.equal(JSON.parse(synced.stderr).processed, 4);
    } finally {
      const documents = check(await service.from('documents').select('id,git_path,metadata').in('git_path', paths), 'quality CLI publications');
      for (const path of paths) {
        const document = documents.find(item => item.git_path === path);
        if (document) ids.push(document.id);
      }
      assert.ok(documents.every(item => item.metadata.embedding_identity === embed.identity), 'CLI model identity drift');
    }
    assert.equal(ids.length, 4);
    mcp = new Client({ name: 'local-quality', version: '1.0.0' });
    await mcp.connect(new StdioClientTransport({ command: process.execPath,
      args: [fileURLToPath(new URL('../src/mcp-server.mjs', import.meta.url))],
      env: { SystemRoot: process.env.SystemRoot, ...embeddingEnv, SUPABASE_URL: url,
        SUPABASE_ANON_KEY: anon, SUPABASE_READER_JWT: session.access_token }, stderr: 'pipe' }));
    let defaultRecall = 0;
    const rows = [];
    for (let index = 0; index < queries.length; index++) {
      const matches = check(await reader.rpc('match_research_items_for_embedding', {
        query_embedding: vectors[index + 4], p_embedding_identity: embed.identity, match_threshold: 0, match_count: 50,
      }), 'real-vector retrieval');
      assert.ok(matches.every(item => item.project === 'CIC'), 'foreign project leaked into real-vector retrieval');
      const fixtures = matches.filter(item => ids.includes(item.document_id));
      assert.equal(fixtures.length, 3, 'all authorized quality fixtures must be searchable');
      if (!calibration) {
        assert.equal(fixtures[0].document_id, ids[index], `semantic query ${index + 1} ranked wrong fixture`);
        assert.ok(fixtures[0].similarity - fixtures[1].similarity >= 0.05, `semantic query ${index + 1} lacks separation`);
      }
      if (calibration) rows.push({ ...calibrationQueries[index], top: ids.indexOf(fixtures[0].document_id), score: fixtures[0].similarity });
      const wired = await mcp.callTool({ name: 'match_research_items',
        arguments: { query: queries[index], match_threshold: 0, match_count: 50 } }, undefined, { timeout: 65000 });
      assert.notEqual(wired.isError, true, 'real local MCP search failed');
      const wiredMatches = JSON.parse(wired.content[0].text);
      assert.equal(wiredMatches.filter(item => ids.includes(item.document_id))[0]?.document_id, fixtures[0].document_id);
      assert.ok(wiredMatches.every(item => item.project === 'CIC'));
      console.log(`Synthetic query ${index + 1}: top fixture ${ids.indexOf(fixtures[0].document_id)}, similarity ${fixtures[0].similarity.toFixed(4)}, margin ${(fixtures[0].similarity - fixtures[1].similarity).toFixed(4)}.`);
      const defaults = check(await reader.rpc('match_research_items_for_embedding', {
        query_embedding: vectors[index + 4], p_embedding_identity: embed.identity,
      }), 'default-threshold retrieval');
      assert.ok(defaults.every(item => item.project === 'CIC' && item.similarity > 0.7), 'default retrieval contract drift');
      const target = calibration ? calibrationQueries[index].target : index;
      if (target !== null && defaults.some(item => item.document_id === ids[target])) defaultRecall++;
    }
    console.log(`Default 0.7 threshold recall on synthetic paraphrases: ${defaultRecall}/${calibration ? 6 : queries.length}; diagnostic, not a production-quality approval.`);
    if (calibration) {
      const tuning = rows.filter(row => row.split === 'tuning');
      const heldout = rows.filter(row => row.split === 'heldout');
      const selected = selectThreshold(tuning);
      const validation = selected === undefined ? null : measure(heldout, selected);
      const accepted = validation !== null && validation.correct === validation.positives && validation.falsePositives === 0;
      console.log(JSON.stringify({ calibration: { scope: 'run-owned fixture results only', selected: selected ?? null,
        accepted,
        tuningDefault: measure(tuning, 0.7), heldoutDefault: measure(heldout, 0.7),
        tuningSelected: selected === undefined ? null : measure(tuning, selected),
        heldoutSelected: validation } }));
      console.log(`Calibration candidate ${accepted ? 'accepted for synthetic fixtures only' : 'rejected; deployment quality gate remains open'}. Harness success is not quality approval.`);
      if (selected !== undefined) {
        for (let index = 0; index < rows.length; index++) {
          const wired = await mcp.callTool({ name: 'match_research_items', arguments: {
            query: queries[index], match_threshold: selected, match_count: 50,
          } }, undefined, { timeout: 65000 });
          assert.notEqual(wired.isError, true);
          const matches = JSON.parse(wired.content[0].text);
          assert.ok(matches.every(item => item.project === 'CIC' && item.similarity > selected));
          const fixtures = matches.filter(item => ids.includes(item.document_id));
          assert.equal(fixtures.length > 0, rows[index].score > selected, 'selected-threshold MCP contract drift');
          if (fixtures.length) assert.equal(ids.indexOf(fixtures[0].document_id), rows[index].top);
        }
        console.log('Selected threshold verified through real MCP/API for all fixed queries.');
      }
    }
  } finally {
    const failures = [];
    if (mcp) {
      try { await mcp.close(); } catch { failures.push('quality MCP shutdown failed'); }
    }
    try { await rm(exports, { recursive: true, force: true }); }
    catch { failures.push('quality local export cleanup failed'); }
    if (paths.length) {
      try {
        await cleanupQualityPublications(service, paths, ids);
      } catch { failures.push('quality document/chunk cleanup unverified'); }
    }
    if (userId) {
      try {
        check(await service.auth.admin.deleteUser(userId), 'quality identity cleanup');
        const gone = await service.auth.admin.getUserById(userId);
        assert.ok(gone.error && !gone.data?.user);
      } catch { failures.push('quality identity cleanup unverified'); }
    }
    assert.deepEqual(failures, [], 'run-owned quality cleanup failed');
    console.log('Run-owned quality documents, chunks, and identity cleaned up.');
  }
});
