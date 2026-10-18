import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  isPackFamilyTitle,
  filterPackFamilySources,
  isSoftwarePack,
  assertAllowedPackNotebook,
  HISTORICAL_NOTEBOOK_IDS,
  replaceGate,
  purgePackFamilyBeforeUpload,
  isStagingOrExcludedPath,
  assertAllowedPackPath,
  EXCLUDED_PACK_DIRS,
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

test('Agent Harness: pack_agent_harness and repo_knowledge_pack are recognized as the same pack family', () => {
  // When uploading pack_agent_harness.txt, repo_knowledge_pack parts are recognized as same family
  assert.equal(isPackFamilyTitle('repo_knowledge_pack.txt', 'pack_agent_harness.txt'), true);
  assert.equal(isPackFamilyTitle('repo_knowledge_pack_part_aa.txt', 'pack_agent_harness.txt'), true);
  assert.equal(isPackFamilyTitle('repo_knowledge_pack_part_as.txt', 'pack_agent_harness.txt'), true);

  // When uploading repo_knowledge_pack.txt, pack_agent_harness.txt is recognized as same family
  assert.equal(isPackFamilyTitle('pack_agent_harness.txt', 'repo_knowledge_pack.txt'), true);
  assert.equal(isPackFamilyTitle('pack_agent_harness.txt', 'repo_knowledge_pack_part_aa.txt'), true);

  // Non-pack sources are still rejected
  assert.equal(isPackFamilyTitle('Ecosystem Architecture Guide (Current).md', 'pack_agent_harness.txt'), false);
  assert.equal(isPackFamilyTitle('Evaluating OpenResearch for Autoresearchers', 'repo_knowledge_pack.txt'), false);
});

test('Agent Harness: filterPackFamilySources matches both pack_agent_harness and repo_knowledge_pack parts', () => {
  const sources = [
    { id: 'src-harness', title: 'pack_agent_harness.txt' },
    { id: 'src-part-aa', title: 'repo_knowledge_pack_part_aa.txt' },
    { id: 'src-part-ab', title: 'repo_knowledge_pack_part_ab.txt' },
    { id: 'src-doc', title: 'Ecosystem Architecture Guide (Current).md' },
  ];

  const matchedHarness = filterPackFamilySources(sources, 'pack_agent_harness.txt');
  assert.equal(matchedHarness.length, 3);
  assert.deepEqual(matchedHarness.map(s => s.id), ['src-harness', 'src-part-aa', 'src-part-ab']);

  const matchedRepo = filterPackFamilySources(sources, 'repo_knowledge_pack.txt');
  assert.equal(matchedRepo.length, 3);
  assert.deepEqual(matchedRepo.map(s => s.id), ['src-harness', 'src-part-aa', 'src-part-ab']);
});

test('Agent Harness: replaceGate in dryRun identifies both pack_agent_harness and repo_knowledge_pack for purging', async () => {
  const agentHarnessId = '359b346c-6af7-4ba3-baef-b985c9e6e1af';
  const result = await replaceGate({
    packFile: path.resolve('tests', 'nlm-pack-replace-gate.test.mjs'),
    targetNbId: agentHarnessId,
    category: 'agent-harness',
    dryRun: true,
  });
  assert.ok(result);
  assert.ok(result.genId);
});

test('Non-pack documents are preserved and never identified as pack families', () => {
  assert.equal(isPackFamilyTitle('Interview transcript - User research.docx', 'pack_agent_harness.txt'), false);
  assert.equal(isPackFamilyTitle('Architecture RFC 2026.md', 'pack_agent_harness.txt'), false);
  assert.equal(isPackFamilyTitle('API Reference - v2.pdf', 'repo_knowledge_pack.txt'), false);
  assert.equal(isPackFamilyTitle('Sprint Review Meeting Notes', 'pack_agent_harness.txt'), false);
});

test('All 19 parts (part_aa..as) match the unified agent harness pack family', () => {
  const parts = ['aa', 'ab', 'ac', 'ad', 'ae', 'af', 'ag', 'ah', 'ai', 'aj', 'ak', 'al', 'am', 'an', 'ao', 'ap', 'aq', 'ar', 'as'];
  for (const p of parts) {
    const filename = `repo_knowledge_pack_part_${p}.txt`;
    assert.equal(isPackFamilyTitle(filename, 'pack_agent_harness.txt'), true, `${filename} should match pack_agent_harness.txt`);
    assert.equal(isPackFamilyTitle('pack_agent_harness.txt', filename), true, `pack_agent_harness.txt should match ${filename}`);
  }
});

test('Agent Harness: reverse purge matching - uploading repo parts matches pack_agent_harness for purging', () => {
  const sources = [
    { id: 'harness-src', title: 'pack_agent_harness.txt' },
    { id: 'part-aa-src', title: 'repo_knowledge_pack_part_aa.txt' },
    { id: 'notes-src', title: 'Daily Digest - Unrelated Notes' },
  ];
  const matched = filterPackFamilySources(sources, 'repo_knowledge_pack_part_as.txt');
  assert.equal(matched.length, 2);
  assert.deepEqual(matched.map(s => s.id), ['harness-src', 'part-aa-src']);
});

test('Agent Harness: case-insensitive and whitespace-trimmed pack family matching', () => {
  assert.equal(isPackFamilyTitle('PACK_AGENT_HARNESS.TXT', 'repo_knowledge_pack.txt'), true);
  assert.equal(isPackFamilyTitle('  repo_knowledge_pack_part_aa.txt  ', 'pack_agent_harness.txt'), true);
  assert.equal(isPackFamilyTitle('Repo_Knowledge_Pack_Part_Az.txt', 'pack_agent_harness.txt'), true);
});

test('isStagingOrExcludedPath detects staging, worktrees, and ignored paths', () => {
  assert.equal(isStagingOrExcludedPath('_kb-sync-staging/pack.txt'), true);
  assert.equal(isStagingOrExcludedPath('c:/dev/_kb-sync-staging/trm/pack.txt'), true);
  assert.equal(isStagingOrExcludedPath('.worktrees/feature/pack.txt'), true);
  assert.equal(isStagingOrExcludedPath('_staging/pack.txt'), true);
  assert.equal(isStagingOrExcludedPath('node_modules/foo/pack.txt'), true);
  assert.equal(isStagingOrExcludedPath('.git/objects/pack.txt'), true);
  assert.equal(isStagingOrExcludedPath('deep/nested/_staging/pack.txt'), true);
  assert.equal(isStagingOrExcludedPath('.nlm_pack/pack_willow_run.txt'), false);
  assert.equal(isStagingOrExcludedPath('wiki/research/note.md'), false);
});

test('assertAllowedPackPath throws STAGING_GUARD_VIOLATION for staging paths', () => {
  assert.throws(
    () => assertAllowedPackPath('_kb-sync-staging/pack.txt'),
    /STAGING_GUARD_VIOLATION/
  );
  assert.throws(
    () => assertAllowedPackPath('.worktrees/branch/pack.txt'),
    /STAGING_GUARD_VIOLATION/
  );
  assert.throws(
    () => assertAllowedPackPath('_staging/pack.txt'),
    /STAGING_GUARD_VIOLATION/
  );
  assert.doesNotThrow(() => assertAllowedPackPath('.nlm_pack/pack_willow_run.txt'));
});

test('replaceGate throws STAGING_GUARD_VIOLATION before attempting upload for staging paths', async () => {
  await assert.rejects(
    async () => {
      await replaceGate({
        packFile: '_kb-sync-staging/test_pack.txt',
        targetNbId: '359b346c-6af7-4ba3-baef-b985c9e6e1af',
        dryRun: true,
      });
    },
    /STAGING_GUARD_VIOLATION/
  );
});


