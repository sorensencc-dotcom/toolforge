import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isPackFamilyTitle,
  filterPackFamilySources,
} from '../scripts/nlm-pack-replace-gate.mjs';

test('isPackFamilyTitle matches pack family titles', () => {
  assert.equal(isPackFamilyTitle('pack_willow_run.txt'), true);
  assert.equal(isPackFamilyTitle('repo_knowledge_pack_master'), true);
  assert.equal(isPackFamilyTitle('Seed Engineering Pack'), true);
  assert.equal(isPackFamilyTitle('Willow Run & Aviation Engineering Pack'), true);
  assert.equal(isPackFamilyTitle('random meeting notes'), false);
  assert.equal(isPackFamilyTitle('Daily Digest'), false);
  assert.equal(isPackFamilyTitle('PACK_MASTER_KB', 'pack_master_kb.txt'), true);
});

test('filterPackFamilySources keeps only pack family', () => {
  const sources = [
    { id: '1', title: 'pack_ford_politics.txt' },
    { id: '2', title: 'Interview transcript' },
    { id: '3', name: 'repo_knowledge_pack_v2' },
  ];
  const matched = filterPackFamilySources(sources, 'pack_ford_politics.txt');
  assert.equal(matched.length, 2);
  assert.deepEqual(matched.map((s) => s.id), ['1', '3']);
});
