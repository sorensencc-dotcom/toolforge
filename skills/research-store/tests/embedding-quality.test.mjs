import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createEmbeddingProvider } from '../src/config.mjs';
import { parseResearchMarkdown } from '../src/sync.mjs';
import { replaceDocument } from '../src/store.mjs';

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
const queries = [
  'What happens to indexed content when vector generation fails?',
  'Can an outdated login token read another project?',
  'How should a broken schema upgrade recover?',
];
const inputs = [...corpus, corpus[0], ...queries];

test('approved real 1536-dimensional embedding availability and synthetic retrieval quality', { timeout: 150000 }, async () => {
  assert.equal(process.env.RESEARCH_UAT_EMBEDDING_APPROVED, '1', 'explicit synthetic egress/cost approval required');
  assert.ok(process.env.OPENAI_API_KEY?.trim(), 'approved OpenAI credential unavailable');
  const inputBytes = inputs.reduce((sum, input) => sum + Buffer.byteLength(input), 0);
  assert.ok(inputBytes <= 4096, 'single-request synthetic fixture budget exceeded');
  // shortcut: $0.02 per million input tokens checked 2026-10-12; recheck after provider repricing.
  assert.ok(inputBytes * 0.02 / 1_000_000 <= 0.10, 'approved $0.10 cap exceeded');
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
  let userId;
  try {
    const email = `research-quality-${randomUUID()}@example.com`;
    const password = randomUUID() + randomUUID();
    userId = check(await service.auth.admin.createUser({ email, password, email_confirm: true,
      app_metadata: { project: 'CIC' } }), 'create quality identity').user.id;
    const reader = createClient(url, anon, options);
    check(await reader.auth.signInWithPassword({ email, password }), 'quality signed login');
    const embed = createEmbeddingProvider({ OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      OPENAI_BASE_URL: 'https://api.openai.com/v1' });
    let vectors;
    try { vectors = await embed(inputs); }
    catch { throw new Error('Real embedding provider unavailable (details suppressed)'); }
    console.log('Real text-embedding-3-small returned seven validated 1536-dimensional vectors in one request.');
    const namespace = `uat124-quality/${randomUUID()}`;
    for (let index = 0; index < 4; index++) {
      const scope = index === 3 ? 'RewriteLabs' : 'CIC';
      const source = parseResearchMarkdown(`---\nproject: ${scope}\nstatus: VERIFIED\ntitle: Synthetic quality ${index}\n---\n${inputs[index]}`,
        `${namespace}/${index}.md`, null);
      ids.push(await replaceDocument(service, source.document, source.chunks, async () => [vectors[index]]));
    }
    let defaultRecall = 0;
    for (let index = 0; index < queries.length; index++) {
      const matches = check(await reader.rpc('match_research_items', {
        query_embedding: vectors[index + 4], match_threshold: 0, match_count: 50,
      }), 'real-vector retrieval');
      assert.ok(matches.every(item => item.project === 'CIC'), 'foreign project leaked into real-vector retrieval');
      const fixtures = matches.filter(item => ids.includes(item.document_id));
      assert.equal(fixtures.length, 3, 'all authorized quality fixtures must be searchable');
      assert.equal(fixtures[0].document_id, ids[index], `semantic query ${index + 1} ranked wrong fixture`);
      assert.ok(fixtures[0].similarity - fixtures[1].similarity >= 0.05, `semantic query ${index + 1} lacks separation`);
      console.log(`Synthetic semantic query ${index + 1}: correct top result, similarity ${fixtures[0].similarity.toFixed(4)}, margin ${(fixtures[0].similarity - fixtures[1].similarity).toFixed(4)}.`);
      const defaults = check(await reader.rpc('match_research_items', {
        query_embedding: vectors[index + 4],
      }), 'default-threshold retrieval');
      assert.ok(defaults.every(item => item.project === 'CIC' && item.similarity > 0.7), 'default retrieval contract drift');
      if (defaults.some(item => item.document_id === ids[index])) defaultRecall++;
    }
    console.log(`Default 0.7 threshold recall on synthetic paraphrases: ${defaultRecall}/${queries.length}; diagnostic, not a production-quality approval.`);
  } finally {
    const failures = [];
    if (ids.length) {
      try {
        check(await service.from('documents').delete().in('id', ids), 'quality fixture cleanup');
        assert.equal(check(await service.from('documents').select('id').in('id', ids), 'quality document cleanup proof').length, 0);
        assert.equal(check(await service.from('research_items').select('id').in('document_id', ids), 'quality chunk cleanup proof').length, 0);
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
