import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  findStaleMiningSources,
  isProtectedNotebook,
  loadProtectedNotebookIds,
  syncPackToNotebook,
  validateDAGSequence,
} from '../scripts/run-daily-notebook-mining.mjs';

test('run-daily-notebook-mining script exists and exports required functions', () => {
  const scriptPath = resolve('scripts/run-daily-notebook-mining.mjs');
  assert.equal(existsSync(scriptPath), true);
  assert.equal(typeof findStaleMiningSources, 'function');
  assert.equal(typeof validateDAGSequence, 'function');
});

test('findStaleMiningSources matches Daily Research pack by filename and title', () => {
  const sources = [
    { id: 'src-1', title: 'pack_daily.txt' },
    { id: 'src-2', title: 'CIC - Daily Research (Buffer/Intake) Pack' },
    { id: 'src-3', title: 'CIC - Daily Research (Buffer/Intake)' },
    { id: 'src-keep', title: 'Research Interview - Oct 12.docx' },
  ];
  const matched = findStaleMiningSources(sources, 'pack_daily.txt', 'CIC - Daily Research (Buffer/Intake)');
  assert.equal(matched.length, 3);
  assert.deepEqual(matched.map(s => s.id), ['src-1', 'src-2', 'src-3']);
});

test('findStaleMiningSources matches Personal OS pack by title (preventing accumulation)', () => {
  const sources = [
    { id: 'p-1', title: 'Personal OS (Household, Utilities, Florida Logistics) Pack' },
    { id: 'p-2', title: 'Personal OS (Household, Utilities, Florida Logistics) Pack' },
    { id: 'p-keep', title: 'Home Insurance Policy 2026.pdf' },
  ];
  const matched = findStaleMiningSources(
    sources,
    'pack_personal_os.txt',
    'Personal OS (Household, Utilities, Florida Logistics)'
  );
  assert.equal(matched.length, 2);
  assert.deepEqual(matched.map(s => s.id), ['p-1', 'p-2']);
});

test('findStaleMiningSources matches Ford Politics pack by both filename and pasted-text title', () => {
  const sources = [
    { id: 'ford-1', title: 'pack_ford_politics.txt' },
    { id: 'ford-2', title: 'CIC - Ford Executive Dynamics & Politics Pack' },
    { id: 'ford-doc', title: 'Ford Executive Board Meeting Minutes 1944.pdf' },
  ];
  const matched = findStaleMiningSources(
    sources,
    'pack_ford_politics.txt',
    'CIC - Ford Executive Dynamics & Politics'
  );
  assert.equal(matched.length, 2);
  assert.deepEqual(matched.map(s => s.id), ['ford-1', 'ford-2']);
});

test('findStaleMiningSources matches legacy monolithic repo_knowledge_pack sources', () => {
  const sources = [
    { id: 'repo-1', title: 'repo_knowledge_pack.txt' },
    { id: 'repo-2', name: 'repo_knowledge_pack_v1.txt' },
    { id: 'other', title: 'System Architecture.md' },
  ];
  const matched = findStaleMiningSources(sources, 'pack_agent_harness.txt', 'Agent Harness');
  assert.equal(matched.length, 2);
  assert.deepEqual(matched.map(s => s.id), ['repo-1', 'repo-2']);
});

test('findStaleMiningSources matches master-kb variations', () => {
  const sources = [
    { id: 'mk-1', title: 'pack_master_kb.txt' },
    { id: 'mk-2', title: 'CIC-KB Pack' },
    { id: 'mk-3', title: 'CIC - Knowledge Base (Master) Pack' },
    { id: 'mk-other', title: 'Master Index.md' },
  ];
  const matched = findStaleMiningSources(
    sources,
    'pack_master_kb.txt',
    'CIC - Knowledge Base (Master)'
  );
  assert.equal(matched.length, 3);
  assert.deepEqual(matched.map(s => s.id), ['mk-1', 'mk-2', 'mk-3']);
});

test('findStaleMiningSources rejects non-pack sources cleanly', () => {
  const sources = [
    { id: 'n-1', title: 'Interview transcript - User research.docx' },
    { id: 'n-2', title: 'Meeting Notes 2026-10-12.txt' },
    { id: 'n-3', title: 'Historical Timeline - Post War.pdf' },
    { id: 'n-4', title: '' },
    { id: 'n-5' },
  ];
  const matched = findStaleMiningSources(sources, 'pack_willow_run.txt', 'CIC - Willow Run & Aviation Engineering');
  assert.equal(matched.length, 0);
});

test('findStaleMiningSources handles empty or invalid inputs gracefully', () => {
  assert.deepEqual(findStaleMiningSources([], 'pack_daily.txt', 'Daily'), []);
  assert.deepEqual(findStaleMiningSources(null, 'pack_daily.txt', 'Daily'), []);
  assert.deepEqual(findStaleMiningSources(undefined, '', ''), []);
});

test('validateDAGSequence enforces strict phase execution order', () => {
  const validPhases = ['load-category', 'harvest', 'extract-properties', 'consolidate-pack', 'validate-pack', 'sync-notebooklm'];
  assert.equal(validateDAGSequence(validPhases), true);

  assert.throws(() => {
    validateDAGSequence(['harvest', 'load-category', 'extract-properties', 'consolidate-pack', 'validate-pack', 'sync-notebooklm']);
  }, /DAG_VALIDATION_ERROR/);
});

const DAILY_ID = '1b4861a3-931f-4632-8fc1-343a8dd37df8';
const partSources = Array.from({ length: 21 }, (_, i) => ({ id: `part-${i + 1}`, title: `pack_daily_part${i + 1}.txt` }));

function fakeNotebook(initial, { failUpload = false, failDeleteIds = [], skipAdd = false } = {}) {
  const sources = [...initial];
  const deleted = [];
  return {
    sources,
    deleted,
    deps: {
      listSources: () => sources.map(s => ({ ...s })),
      uploadSource: (_id, _file, title) => {
        if (failUpload) throw new Error('upload boom');
        if (!skipAdd) sources.push({ id: 'new-1', title });
      },
      deleteSource: (id) => {
        if (failDeleteIds.includes(id)) throw new Error('delete boom');
        deleted.push(id);
        sources.splice(sources.findIndex(s => s.id === id), 1);
      },
    },
  };
}

const syncArgs = (deps) => ({
  targetUuid: DAILY_ID,
  packFile: '/x/.nlm_pack/pack_daily.txt',
  packTitle: 'CIC - Daily Research (Buffer/Intake) Pack',
  categoryTitle: 'CIC - Daily Research (Buffer/Intake)',
  deps,
});

test('findStaleMiningSources never treats multipart pack_daily_partN as stale', () => {
  const matched = findStaleMiningSources(partSources, 'pack_daily.txt', 'CIC - Daily Research (Buffer/Intake)');
  assert.deepEqual(matched, []);
});

test('findStaleMiningSources uses stem boundaries, not substring', () => {
  const sources = [
    { id: 'a', title: 'notes about pack_daily summary.txt' },
    { id: 'b', title: 'pack_daily_extra.txt' },
    { id: 'c', title: 'pack_daily-v2.txt' },
  ];
  const matched = findStaleMiningSources(sources, 'pack_daily.txt', '');
  assert.deepEqual(matched.map(s => s.id), ['b', 'c']);
});

test('protected set includes fallback IDs when the kb-sync manifest is missing', () => {
  const ids = loadProtectedNotebookIds({ KB_SYNC_MANIFEST_PATH: '/nope/missing.json' }, () => { throw new Error('ENOENT'); });
  for (const id of [DAILY_ID, '679b8bab-2d87-42cb-a726-6dc54c83acc2', '359b346c-6af7-4ba3-baef-b985c9e6e1af']) {
    assert.equal(isProtectedNotebook(id, ids), true);
  }
  assert.equal(isProtectedNotebook('unrelated-id', ids), false);
});

test('protected set adds every notebook from the kb-sync registry', () => {
  const manifest = JSON.stringify({ clusters: { c1: { notebooks: [{ uuid: 'ABC-123' }, { uuid: 'def-456' }] } } });
  const ids = loadProtectedNotebookIds({ KB_SYNC_MANIFEST_PATH: '/m.json' }, () => manifest);
  assert.equal(isProtectedNotebook('abc-123', ids), true);
  assert.equal(isProtectedNotebook('def-456', ids), true);
  assert.equal(isProtectedNotebook(DAILY_ID, ids), true);
});

test('syncPackToNotebook leaves a 21-part Daily notebook intact and removes only the old monolith', () => {
  const nb = fakeNotebook([...partSources, { id: 'old-mono', title: 'pack_daily.txt' }]);
  const result = syncPackToNotebook(syncArgs(nb.deps));
  assert.equal(result.ok, true);
  assert.deepEqual(nb.deleted, ['old-mono']);
  assert.equal(nb.sources.filter(s => s.id.startsWith('part-')).length, 21);
  assert.equal(nb.sources.some(s => s.id === 'new-1'), true);
});

test('syncPackToNotebook deletes nothing when only multipart sources exist', () => {
  const nb = fakeNotebook(partSources);
  const result = syncPackToNotebook(syncArgs(nb.deps));
  assert.equal(result.ok, true);
  assert.deepEqual(nb.deleted, []);
  assert.equal(nb.sources.length, 22);
});

test('syncPackToNotebook deletes nothing when upload fails', () => {
  const nb = fakeNotebook([...partSources, { id: 'old-mono', title: 'pack_daily.txt' }], { failUpload: true });
  const result = syncPackToNotebook(syncArgs(nb.deps));
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'upload_failed');
  assert.deepEqual(nb.deleted, []);
});

test('syncPackToNotebook deletes nothing when the upload cannot be confirmed', () => {
  const nb = fakeNotebook([{ id: 'old-mono', title: 'pack_daily.txt' }], { skipAdd: true });
  const result = syncPackToNotebook(syncArgs(nb.deps));
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'upload_unconfirmed');
  assert.deepEqual(nb.deleted, []);
});

test('syncPackToNotebook fails the category when a stale delete fails, and never deletes the new source', () => {
  const nb = fakeNotebook(
    [{ id: 'old-1', title: 'pack_daily.txt' }, { id: 'old-2', title: 'pack_daily.bak.txt' }],
    { failDeleteIds: ['old-1'] },
  );
  const result = syncPackToNotebook(syncArgs(nb.deps));
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'prune_failed');
  assert.deepEqual(result.failedDeletes, ['old-1']);
  assert.equal(nb.deleted.includes('new-1'), false);
  assert.equal(nb.sources.some(s => s.id === 'new-1'), true);
});

test('syncPackToNotebook never deletes a new source that shares the old pack title', () => {
  const nb = fakeNotebook([{ id: 'old-title', title: 'CIC - Daily Research (Buffer/Intake) Pack' }]);
  const result = syncPackToNotebook(syncArgs(nb.deps));
  assert.equal(result.ok, true);
  assert.deepEqual(nb.deleted, ['old-title']);
  assert.equal(nb.sources.some(s => s.id === 'new-1'), true);
});
