import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  archiveStaleFixtures,
  isCodeCard,
  findResearchDeliverable,
  runTestWithTimeout,
  processCard
} from '../scripts/trm-factory-runner.mjs';

function createTempDir(name) {
  const dir = path.join(os.tmpdir(), `trm-runner-test-${name}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

test('isCodeCard: correctly discriminates between code repos and non-code research domains', () => {
  assert.equal(isCodeCard({ target: 'sigil' }), true);
  assert.equal(isCodeCard({ target: 'kb-sync' }), true);
  assert.equal(isCodeCard({ target: 'toolforge' }), true);
  assert.equal(isCodeCard({ target: 'IronLedger' }), true);

  assert.equal(isCodeCard({ target: 'research' }), false);
  assert.equal(isCodeCard({ target: 'cic' }), false);
  assert.equal(isCodeCard({ target: 'cic-kb' }), false);
  assert.equal(isCodeCard({ target: 'whichllm' }), false);
  assert.equal(isCodeCard(null), false);
  assert.equal(isCodeCard({}), false);
});

test('findResearchDeliverable: matches GAP-20 and Cork audit descriptors against wiki artifacts', () => {
  const tmpWiki = createTempDir('wiki');
  try {
    fs.writeFileSync(path.join(tmpWiki, 'rfc-gap-20-sorensen-oral-history-censorship.md'), '# GAP-20', 'utf8');
    fs.writeFileSync(path.join(tmpWiki, 'cic-archival-audit-cork-operations-investigation.md'), '# Cork', 'utf8');

    const gap20Card = {
      title: 'bombard-williamson-redaction-index',
      intent: 'bombard_williamson_redaction_index',
      context: { body: 'Analysis of GAP-20 redactions' }
    };
    const gap20Match = findResearchDeliverable(gap20Card, tmpWiki);
    assert.equal(gap20Match, 'rfc-gap-20-sorensen-oral-history-censorship.md');

    const corkCard = {
      title: 'CIC Archival Audit & Cork Operations Investigation',
      intent: 'cic_archival_audit_cork_operations_investigation'
    };
    const corkMatch = findResearchDeliverable(corkCard, tmpWiki);
    assert.equal(corkMatch, 'cic-archival-audit-cork-operations-investigation.md');

    const unmatchedCard = {
      title: 'Unrelated topic without artifact',
      intent: 'unrelated_topic'
    };
    assert.equal(findResearchDeliverable(unmatchedCard, tmpWiki), null);
  } finally {
    try { fs.rmSync(tmpWiki, { recursive: true, force: true }); } catch {}
  }
});

test('runTestWithTimeout: executes Node test contracts and returns structured result', () => {
  const tmpDir = createTempDir('test-runner');
  const passingTest = path.join(tmpDir, 'sample.test.mjs');
  fs.writeFileSync(passingTest, `
    import test from 'node:test';
    import assert from 'node:assert/strict';
    test('passing assertion', () => {
      assert.ok(true);
    });
  `, 'utf8');

  try {
    const res = runTestWithTimeout(passingTest, tmpDir, 10000);
    assert.equal(res.success, true);
    assert.equal(res.timedOut, false);
    assert.equal(typeof res.duration, 'number');
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
});

test('runTestWithTimeout: enforces hard timeout limit when process hangs', () => {
  const tmpDir = createTempDir('test-timeout');
  const hangingTest = path.join(tmpDir, 'hanging.test.mjs');
  // Hangs for 5 seconds
  fs.writeFileSync(hangingTest, `
    import test from 'node:test';
    test('hang', async () => {
      await new Promise(r => setTimeout(r, 5000));
    });
  `, 'utf8');

  try {
    // 100ms timeout
    const res = runTestWithTimeout(hangingTest, tmpDir, 100);
    assert.equal(res.success, false);
    assert.equal(res.timedOut, true);
    assert.match(res.error, /timeout limit/);
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
});

test('processCard: transitions completed research card to completed directory', () => {
  const tmpBase = createTempDir('factory-harness');
  const tmpPending = path.join(tmpBase, 'pending');
  const tmpCompleted = path.join(tmpBase, 'completed');
  const tmpWiki = path.join(tmpBase, 'wiki');
  fs.mkdirSync(tmpPending, { recursive: true });
  fs.mkdirSync(tmpCompleted, { recursive: true });
  fs.mkdirSync(tmpWiki, { recursive: true });

  const researchCard = path.join(tmpPending, 'act-gap20.json');
  fs.writeFileSync(researchCard, JSON.stringify({
    id: 'act-gap20',
    target: 'research',
    title: 'bombard-williamson-redaction-index',
    intent: 'bombard_williamson_redaction_index'
  }), 'utf8');

  fs.writeFileSync(path.join(tmpWiki, 'rfc-gap-20-sorensen-oral-history-censorship.md'), '# GAP-20 RFC', 'utf8');

  try {
    const res = processCard(researchCard, {
      dryRun: false,
      wikiDir: tmpWiki,
      completedDir: tmpCompleted
    });

    assert.equal(res.status, 'COMPLETED');
    assert.equal(res.type, 'RESEARCH');
    assert.equal(res.researchDeliverable, 'rfc-gap-20-sorensen-oral-history-censorship.md');
  } finally {
    try { fs.rmSync(tmpBase, { recursive: true, force: true }); } catch {}
  }
});
