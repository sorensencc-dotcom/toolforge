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
import { FILE_PROJECT, ORIGINAL_BUCKET, scanOriginals, publishOriginals, createOriginalStore } from '../src/file-sync.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const run = promisify(execFile);
const checked = result => { if (result.error) throw new Error('DEV/UAT operation failed; details suppressed'); return result.data; };

test('DEV/UAT originals preserve bytes, repeat safely, and deny anonymous access', { timeout: 150000 }, async () => {
  assert.equal((await readFile(join(root, 'supabase/.temp/project-ref'), 'utf8')).trim(), FILE_PROJECT);
  let stdout;
  try {
    ({ stdout } = await run('C:\\Program Files\\Git\\bin\\bash.exe', ['-lc',
      `timeout 25s npx --yes supabase projects api-keys --project-ref ${FILE_PROJECT} --reveal --output-format json`],
    { cwd: root, timeout: 27000, maxBuffer: 1024 * 1024 }));
  } catch { throw new Error('DEV/UAT credential lookup failed; output suppressed'); }
  const keys = JSON.parse(stdout).keys;
  const key = keys.find(item => item.name === 'service_role')?.api_key;
  const anon = keys.find(item => item.name === 'anon')?.api_key;
  assert.ok(key && anon, 'DEV/UAT credentials unavailable');
  const url = `https://${FILE_PROJECT}.supabase.co`;
  const options = { auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, redirect: 'error', signal: AbortSignal.timeout(15000) }) } };
  const service = createClient(url, key, options);
  const reader = createClient(url, anon, options);
  const bucket = await service.storage.getBucket(ORIGINAL_BUCKET);
  if (bucket.error) {
    assert.equal(String(bucket.error.statusCode), '404', 'Bucket lookup failed; refusing creation');
    checked(await service.storage.createBucket(ORIGINAL_BUCKET, { public: false, fileSizeLimit: 50_000_000 }));
  } else assert.equal(bucket.data.public, false);
  const store = createOriginalStore({ url, key, maxFileBytes: 50_000_000 });
  await store.ready();
  const directory = await mkdtemp(join(tmpdir(), 'original-uat-'));
  const source = { id: `uat-files-${randomUUID()}`, root: join(directory, 'source') };
  const objects = new Set();
  try {
    await mkdir(source.root);
    const stage = join(directory, 'stage');
    await mkdir(stage);
    const original = Buffer.from('---\nstatus: active\n---\nSynthetic original without embeddings.\n');
    await writeFile(join(source.root, 'note.md'), original);
    const captured = await scanOriginals([source], { stagingRoot: stage, maxTotalBytes: 1024 });
    assert.deepEqual(captured.errors, []);
    assert.equal(captured.entries.length, 1);
    const row = captured.entries[0];
    objects.add(row.storage_key);
    assert.deepEqual(await publishOriginals(captured.entries, store), { stored: 1, unchanged: 0 });
    assert.deepEqual(await publishOriginals(captured.entries, store), { stored: 0, unchanged: 1 });
    const saved = checked(await service.from('research_original_files').select('*').eq('source_key', source.id));
    assert.equal(saved.length, 1);
    assert.equal(saved[0].text_content, original.toString());
    const downloaded = checked(await service.storage.from(ORIGINAL_BUCKET).download(row.storage_key));
    assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), original);
    assert.ok((await reader.from('research_original_files').select('*').eq('source_key', source.id)).error);
    assert.ok((await reader.storage.from(ORIGINAL_BUCKET).download(row.storage_key)).error);
    assert.deepEqual(await publishOriginals([], store), { stored: 0, unchanged: 0 });
    assert.equal(checked(await service.from('research_original_files').select('source_key').eq('source_key', source.id)).length, 1);
    console.log('Original bytes, raw frontmatter, repeat safety, retain-missing, and anonymous denial verified; zero embeddings.');
  } finally {
    checked(await service.from('research_original_files').delete().eq('source_key', source.id));
    if (objects.size) checked(await service.storage.from(ORIGINAL_BUCKET).remove([...objects]));
    assert.equal(checked(await service.from('research_original_files').select('source_key').eq('source_key', source.id)).length, 0);
    // Object listing checks authoritative absence; download edges can retain cached bytes.
    assert.deepEqual(checked(await service.storage.from(ORIGINAL_BUCKET).list(source.id)), []);
    await rm(directory, { recursive: true, force: true });
    console.log('Run-owned synthetic rows, objects, and staging cleaned; absence verified.');
  }
});
