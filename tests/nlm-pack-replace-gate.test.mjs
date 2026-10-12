import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isPackFamilyTitle,
  filterPackFamilySources,
  isSoftwarePack,
  assertAllowedPackNotebook,
  HISTORICAL_NOTEBOOK_IDS,
  replaceGate,
  purgePackFamilyBeforeUpload,
} from '../scripts/nlm-pack-replace-gate.mjs';

test('isPackFamilyTitle matches pack family titles', () => {
  assert.equal(isPackFamilyTitle('pack_willow_run.txt'), true);
  assert.equal(isPackFamilyTitle('repo_knowledge_pack_master'), true);
  assert.equal(isPackFamilyTitle('Seed Engineering Pack'), true);
  assert.equal(isPackFamilyTitle('Willow Run & Aviation Engineering Pack'), true);
  assert.equal(isPackFamilyTitle('CIC - Ford Executive Dynamics & Politics Pack'), true);
  assert.equal(isPackFamilyTitle('CIC - Ford Executive Dynamics & Politics Pack', 'pack_ford_politics.txt'), true);
  assert.equal(isPackFamilyTitle('Master Knowledge Pack'), true);
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

test('isSoftwarePack identifies repo packs and software categories', () => {
  assert.equal(isSoftwarePack('repo_knowledge_pack.txt'), true);
  assert.equal(isSoftwarePack('repo_knowledge_pack_part_aa.txt'), true);
  assert.equal(isSoftwarePack('repo_knowledge_pack_part_as.txt'), true);
  assert.equal(isSoftwarePack('pack_agent_harness.txt'), true);
  assert.equal(isSoftwarePack('pack_ironledger.txt'), true);
  assert.equal(isSoftwarePack('pack_sigil.txt'), true);
  assert.equal(isSoftwarePack('agent_harness'), true);

  // Historical packs should NOT be identified as software packs
  assert.equal(isSoftwarePack('pack_master_kb.txt'), false);
  assert.equal(isSoftwarePack('pack_master_kb_part1.txt'), false);
  assert.equal(isSoftwarePack('pack_willow_run.txt'), false);
  assert.equal(isSoftwarePack('pack_ford_politics.txt'), false);
  assert.equal(isSoftwarePack('pack_cuba_claims.txt'), false);
  assert.equal(isSoftwarePack('meeting_notes.txt'), false);
});

test('assertAllowedPackNotebook blocks software pack uploads to historical notebooks', () => {
  const cicKbId = '679b8bab-2d87-42cb-a726-6dc54c83acc2';
  const willowRunId = '6fd7c40b-df90-444b-9c7a-a64682925856';

  // Blocks repo_knowledge_pack and chunked parts to CIC-KB
  assert.throws(
    () => assertAllowedPackNotebook(cicKbId, 'repo_knowledge_pack.txt'),
    /ROUTING_GUARD_VIOLATION.*Refusing to upload software pack/
  );
  assert.throws(
    () => assertAllowedPackNotebook(cicKbId, 'repo_knowledge_pack_part_aa.txt'),
    /ROUTING_GUARD_VIOLATION.*Refusing to upload software pack/
  );
  assert.throws(
    () => assertAllowedPackNotebook(willowRunId, 'repo_knowledge_pack.txt'),
    /ROUTING_GUARD_VIOLATION.*Refusing to upload software pack/
  );
  assert.throws(
    () => assertAllowedPackNotebook(cicKbId, 'pack_agent_harness.txt'),
    /ROUTING_GUARD_VIOLATION.*Refusing to upload software pack/
  );
});

test('assertAllowedPackNotebook allows software packs to Core Software notebooks and historical packs to historical notebooks', () => {
  const agentHarnessId = '359b346c-6af7-4ba3-baef-b985c9e6e1af';
  const ironLedgerId = '76e1932c-054a-4520-9e83-5e882dffc938';
  const cicKbId = '679b8bab-2d87-42cb-a726-6dc54c83acc2';
  const willowRunId = '6fd7c40b-df90-444b-9c7a-a64682925856';

  // Allowed: Software packs into Core Software notebooks
  assert.doesNotThrow(() => assertAllowedPackNotebook(agentHarnessId, 'repo_knowledge_pack.txt'));
  assert.doesNotThrow(() => assertAllowedPackNotebook(agentHarnessId, 'repo_knowledge_pack_part_aa.txt'));
  assert.doesNotThrow(() => assertAllowedPackNotebook(ironLedgerId, 'pack_ironledger.txt'));

  // Allowed: Historical packs into historical notebooks
  assert.doesNotThrow(() => assertAllowedPackNotebook(cicKbId, 'pack_master_kb.txt'));
  assert.doesNotThrow(() => assertAllowedPackNotebook(cicKbId, 'pack_master_kb_part1.txt'));
  assert.doesNotThrow(() => assertAllowedPackNotebook(willowRunId, 'pack_willow_run.txt'));
});

test('replaceGate throws ROUTING_GUARD_VIOLATION before attempting upload to historical notebook', async () => {
  const cicKbId = '679b8bab-2d87-42cb-a726-6dc54c83acc2';
  await assert.rejects(
    async () => {
      await replaceGate({
        packFile: 'repo_knowledge_pack.txt',
        targetNbId: cicKbId,
        category: 'repo-knowledge-pack',
        dryRun: true,
      });
    },
    /ROUTING_GUARD_VIOLATION/
  );
});

test('purgePackFamilyBeforeUpload throws ROUTING_GUARD_VIOLATION for software packs in historical notebook', () => {
  const cicKbId = '679b8bab-2d87-42cb-a726-6dc54c83acc2';
  assert.throws(
    () => {
      purgePackFamilyBeforeUpload({
        cli: 'mock-cli',
        notebookId: cicKbId,
        packFile: 'repo_knowledge_pack.txt',
        dryRun: true,
      });
    },
    /ROUTING_GUARD_VIOLATION/
  );
});
