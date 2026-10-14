import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  findStaleMiningSources,
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
