import test from 'node:test';
import assert from 'node:assert/strict';
import fs, { mkdtemp, writeFile, readFile, rm, mkdir, symlink, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { syncBuiltinESMExports } from 'node:module';

const loadSync = () => import('../src/sync.mjs');
const loadStore = () => import('../src/store.mjs');
const id = '11111111-1111-4111-8111-111111111111';
const vector = () => Array(1536).fill(0.1);
const identified = fn => Object.assign(fn, { identity: 'fixture:model:1536' });
const document = { project: 'CIC', git_path: 'note.md', title: 'Note', content_hash: 'old' };

test('LF and CRLF frontmatter preserve Drive provenance and paragraph chunks', async () => {
  const { parseResearchMarkdown } = await loadSync();
  const raw = '---\nproject: RewriteLabs\ntitle: Export\nsource_system: drive\ndrive_file_id: export-id\nsource_uri: https://drive.google.com/file/d/export-id\nstatus: VERIFIED\nconfidence: 0.75\n---\nFirst.\n\nSecond.';
  for (const input of [raw, raw.replaceAll('\n', '\r\n')]) {
    const result = parseResearchMarkdown(input, 'export.md', null);
    assert.equal(result.document.project, 'RewriteLabs');
    assert.equal(result.document.title, 'Export');
    assert.equal(result.document.source_system, 'drive');
    assert.equal(result.document.drive_file_id, 'export-id');
    assert.equal(result.document.source_uri, 'https://drive.google.com/file/d/export-id');
    assert.equal(result.document.metadata.status, 'VERIFIED');
    assert.deepEqual(result.chunks, ['First.', 'Second.']);
  }
});

test('malformed frontmatter, unsupported project/status, and invalid confidence reject', async () => {
  const { parseResearchMarkdown } = await loadSync();
  for (const yaml of [
    'title: [',
    'scalar',
    'project: foreign',
    'status: approved',
    'confidence: 1.1',
    'confidence: -0.1',
    'x: !!js/function >\n  function(){ return 1 }',
    'x: !!python/object/apply:os.system [echo owned]',
  ]) {
    assert.throws(() => parseResearchMarkdown(`---\n${yaml}\n---\nBody`, 'note.md', null));
  }
  assert.throws(() => parseResearchMarkdown('Body', '../outside.md', null));
  assert.throws(() => parseResearchMarkdown('x'.repeat(8001), 'note.md', null));
});

test('project filtering and empty body preserve defaults', async () => {
  const { parseResearchMarkdown } = await loadSync();
  assert.equal(parseResearchMarkdown('---\nproject: RewriteLabs\n---\nBody', 'note.md', 'CIC'), null);
  const result = parseResearchMarkdown('', 'empty.md', null);
  assert.deepEqual(result.chunks, []);
  assert.equal(result.document.project, 'CIC');
  assert.equal(result.document.metadata.status, 'UNKNOWN');
});

test('embedding failure cannot publish document or chunks', async () => {
  const { replaceDocument } = await loadStore();
  let calls = 0;
  const supabase = { rpc: async () => { calls++; }, from: () => { calls++; } };
  await assert.rejects(replaceDocument(supabase, document, ['Body'], async () => { throw new Error('embedding unavailable'); }));
  assert.equal(calls, 0);
});

test('384-dimensional, missing, and nonfinite embeddings reject before writes', async () => {
  const { replaceDocument } = await loadStore();
  for (const embeddings of [[], [Array(384).fill(0.1)], [[NaN, ...vector().slice(1)]], [[Infinity, ...vector().slice(1)]]]) {
    let calls = 0;
    await assert.rejects(replaceDocument({ rpc: async () => { calls++; } }, document, ['Body'], async () => embeddings));
    assert.equal(calls, 0);
  }
});

test('metadata and complete current chunks publish in one replacement RPC', async () => {
  const { replaceDocument } = await loadStore();
  const calls = [];
  const supabase = { rpc: async (...args) => { calls.push(args); return { data: id, error: null }; } };
  const changed = { ...document, title: 'Updated title' };
  assert.equal(await replaceDocument(supabase, changed, ['Remaining'], identified(async () => [vector()])), id);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'replace_research_document');
  assert.equal(calls[0][1].p_document.title, 'Updated title');
  assert.equal(calls[0][1].p_document.content_hash, 'old');
  assert.equal(calls[0][1].p_items.length, 1);
  assert.equal(calls[0][1].p_items[0].chunk_index, 0);
  assert.equal(calls[0][1].p_items[0].content, 'Remaining');
  assert.deepEqual(calls[0][1].p_items[0].embedding, vector());
  assert.equal(calls[0][1].p_items[0].metadata.embedding_identity, 'fixture:model:1536');
  assert.equal(calls[0][1].p_document.metadata.embedding_identity, 'fixture:model:1536');
});

test('unidentified vectors cannot be published or spoofed through source metadata', async () => {
  const { replaceDocument } = await loadStore();
  let writes = 0;
  await assert.rejects(replaceDocument({ rpc: async () => { writes++; } },
    { ...document, metadata: { embedding_identity: 'spoofed' } }, ['Body'], async () => [vector()]), /identity/);
  assert.equal(writes, 0);
});

test('empty replacement clears chunks without embedding', async () => {
  const { replaceDocument } = await loadStore();
  let embedCalls = 0;
  let payload;
  await replaceDocument({ rpc: async (_name, args) => { payload = args; return { data: id, error: null }; } }, document, [], async () => { embedCalls++; });
  assert.equal(embedCalls, 0);
  assert.deepEqual(payload.p_items, []);
});

test('database rejection propagates as failed ingestion', async () => {
  const { replaceDocument } = await loadStore();
  await assert.rejects(replaceDocument({ rpc: async () => ({ data: null, error: { message: 'write rejected' } }) }, document, ['Body'], identified(async () => [vector()])), /replacement/);
});

test('dry run makes no network calls and counts malformed files as failures', async () => {
  const { syncResearch } = await loadSync();
  const root = await mkdtemp(join(tmpdir(), 'research-store-test-'));
  const valid = '---\ntitle: Valid\n---\nBody';
  try {
    await writeFile(join(root, 'valid.md'), valid);
    await writeFile(join(root, 'invalid.md'), '---\ntitle: [\n---\nBody');
    let calls = 0;
    const result = await syncResearch({ root, project: null, dryRun: true }, {
      supabase: { rpc: async () => { calls++; } }, embed: async () => { calls++; },
    });
    assert.equal(result.failed, 1);
    assert.equal(calls, 0);
    assert.equal(await readFile(join(root, 'valid.md'), 'utf8'), valid);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('embedding batches cap at sixteen and publish only after all batches succeed', async () => {
  const { replaceDocument } = await loadStore();
  const chunks = Array.from({ length: 17 }, (_, index) => `Chunk ${index}`);
  const batches = [];
  let writes = 0;
  const rpc = async () => { writes++; return { data: id, error: null }; };
  await replaceDocument({ rpc }, document, chunks, identified(async texts => {
    batches.push(texts.length);
    return texts.map(() => vector());
  }));
  assert.deepEqual(batches, [16, 1]);
  assert.equal(writes, 1);
  writes = 0;
  await assert.rejects(replaceDocument({ rpc }, document, chunks, identified(async texts => {
    if (texts.length === 1) throw new Error('Second batch failed');
    return texts.map(() => vector());
  })));
  assert.equal(writes, 0);
});

test('directory junction outside research root never becomes embedding input', async () => {
  const { syncResearch } = await loadSync();
  const parent = await mkdtemp(join(tmpdir(), 'research-junction-test-'));
  const root = join(parent, 'research');
  const outside = join(parent, 'outside');
  try {
    await mkdir(root);
    await mkdir(outside);
    await writeFile(join(outside, 'external.md'), 'Never index this external fixture.');
    await symlink(outside, join(root, 'junction'), process.platform === 'win32' ? 'junction' : 'dir');
    let calls = 0;
    const result = await syncResearch({ root }, { supabase: { rpc: async () => { calls++; } }, embed: async () => { calls++; } });
    assert.deepEqual(result, { processed: 0, skipped: 1, failed: 0 });
    assert.equal(calls, 0);
  } finally { await rm(parent, { recursive: true, force: true }); }
});

test('UTF-8 BOM preserves frontmatter project and rejects malformed YAML', async () => {
  const { parseResearchMarkdown } = await loadSync();
  const bom = String.fromCharCode(0xFEFF);
  const parsed = parseResearchMarkdown(`${bom}---\nproject: RewriteLabs\nstatus: VERIFIED\n---\nBody`, 'export.md', null);
  assert.equal(parsed.document.project, 'RewriteLabs');
  assert.equal(parsed.document.metadata.status, 'VERIFIED');
  assert.deepEqual(parsed.chunks, ['Body']);
  assert.throws(() => parseResearchMarkdown(`${bom}---\ntitle: [\n---\nBody`, 'export.md', null));
});

test('junction swap between validation and open cannot embed outside-root content', async t => {
  const { syncResearch } = await loadSync();
  const parent = await mkdtemp(join(tmpdir(), 'research-race-test-'));
  const root = join(parent, 'research');
  const sub = join(root, 'sub');
  const outside = join(parent, 'outside');
  const originalOpen = fs.open;
  const originalRead = fs.readFile;
  let swapped = false;
  let embeds = 0;
  async function swap() {
    if (swapped) return;
    swapped = true;
    await rename(sub, join(root, 'old'));
    await symlink(outside, sub, process.platform === 'win32' ? 'junction' : 'dir');
  }
  try {
    await mkdir(sub, { recursive: true });
    await mkdir(outside);
    await writeFile(join(sub, 'note.md'), 'Inside');
    await writeFile(join(outside, 'note.md'), 'External fixture must not leave root');
    t.mock.method(fs, 'open', async (...args) => { await swap(); return originalOpen(...args); });
    t.mock.method(fs, 'readFile', async (...args) => { await swap(); return originalRead(...args); });
    syncBuiltinESMExports();
    const result = await syncResearch({ root }, {
      supabase: { rpc: async () => ({ data: id, error: null }) },
      embed: async texts => { embeds++; return texts.map(() => vector()); },
    });
    assert.equal(swapped, true);
    assert.equal(embeds, 0);
    assert.equal(result.failed, 1);
  } finally {
    t.mock.restoreAll();
    syncBuiltinESMExports();
    await rm(parent, { recursive: true, force: true });
  }
});
