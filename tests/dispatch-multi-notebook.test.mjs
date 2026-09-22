import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDispatchPlan, dispatchMultiNotebook } from '../scripts/notebooklm/dispatch-multi-notebook.mjs';

test('buildDispatchPlan maps consolidated packs to notebook tasks', () => {
  const plan = buildDispatchPlan([
    { packDef: { category: 'willow-run', notebookId: 'uuid-1', title: 'Willow Run' }, packFile: '/path/pack_willow_run.txt' },
    { packDef: { category: 'cuba-claims', notebookId: 'uuid-2', title: 'Cuba Claims' }, packFile: '/path/pack_cuba_claims.txt' }
  ]);

  assert.deepEqual(plan, [
    { category: 'willow-run', title: 'Willow Run', notebookId: 'uuid-1', packFile: '/path/pack_willow_run.txt', filename: 'pack_willow_run.txt' },
    { category: 'cuba-claims', title: 'Cuba Claims', notebookId: 'uuid-2', packFile: '/path/pack_cuba_claims.txt', filename: 'pack_cuba_claims.txt' }
  ]);
});

test('dispatchMultiNotebook dry-run uses a bounded pool without spawning', async () => {
  const result = await dispatchMultiNotebook({
    generatedPacks: [
      { packDef: { category: 'a', notebookId: '1', title: 'A' }, packFile: 'a.txt' },
      { packDef: { category: 'b', notebookId: '2', title: 'B' }, packFile: 'b.txt' }
    ],
    concurrency: 1,
    dryRun: true
  });

  assert.equal(result.success, true);
  assert.deepEqual(result.results.map(({ status }) => status), ['dry-run-ok', 'dry-run-ok']);
});
