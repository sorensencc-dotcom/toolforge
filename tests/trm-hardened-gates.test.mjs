import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validateIngressQuality,
  getRoutingDecision,
  processFile
} from '../scripts/trm-ingress-watcher.mjs';
import {
  resolveTargetRepo,
  promoteCard,
  parseCardFile,
  updateCardFrontmatter,
  DEFAULT_REPO_MAP,
  NON_CODE_TARGETS
} from '../scripts/trm-promote-card.mjs';
import {
  resolveLocalRepoDir,
  loadCardData,
  generateTestScaffold,
  REPO_LOCAL_PATHS
} from '../scripts/trm-stage-pr.mjs';
import {
  resolveTargetRepo as serverResolveTargetRepo,
  loadArchivedCard
} from '../icf/src/server.mjs';

import os from 'node:os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_TMP_BASE = path.resolve(os.homedir(), '.tmp/trm-test-gates');

function createTempDir(name) {
  const dir = path.join(TEST_TMP_BASE, `${name}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

test('Quality Gate: validateIngressQuality rejects gdoc fetch failures and stubs', () => {
  // 1. GDoc fetch failure
  const gdocFail = validateIngressQuality({
    id: 'act-test-fail',
    context: { body_fetch_failed: true }
  });
  assert.equal(gdocFail.valid, false);
  assert.equal(gdocFail.reason, 'GDOC_BODY_FETCH_FAILED');

  // 2. Insufficient content length
  const tooShort = validateIngressQuality({
    id: 'act-short',
    summary: 'Fix bug'
  });
  assert.equal(tooShort.valid, false);
  assert.equal(tooShort.reason, 'INSUFFICIENT_CONTENT');

  // 3. Stub / placeholder metadata
  const stubTitle = validateIngressQuality({
    id: 'act-unknown',
    title: 'Unknown Title',
    summary: 'A'.repeat(100)
  });
  assert.equal(stubTitle.valid, false);
  assert.equal(stubTitle.reason, 'STUB_METADATA_ONLY');

  // 4. Substantive content passes
  const validCard = validateIngressQuality({
    id: 'act-good',
    title: 'Harden Ingress Quality Gate',
    summary: 'Detailed architectural directive with clear acceptance criteria and specifications for the gate.'
  });
  assert.equal(validCard.valid, true);
});

test('Routing Gate: resolveTargetRepo strictly forbids fallback to toolforge', () => {
  // Explicit mapped code targets
  assert.equal(resolveTargetRepo('sigil'), 'sorensencc-dotcom/sigil');
  assert.equal(resolveTargetRepo('kb-sync'), 'sorensencc-dotcom/kb-sync');
  assert.equal(resolveTargetRepo('rewrite-mcp'), 'sorensencc-dotcom/rewrite-mcp');
  assert.equal(resolveTargetRepo('ironledger'), 'sorensencc-dotcom/IronLedger');
  assert.equal(resolveTargetRepo('toolforge'), 'sorensencc-dotcom/toolforge');

  // Null/empty target returns null (NO toolforge fallback)
  assert.equal(resolveTargetRepo(null), null);
  assert.equal(resolveTargetRepo(''), null);

  // Research topics return null (cannot be converted to github code repo)
  assert.equal(resolveTargetRepo('cic'), null);
  assert.equal(resolveTargetRepo('cic-kb'), null);
  assert.equal(resolveTargetRepo('strategic-intelligence'), null);
  assert.equal(resolveTargetRepo('cross-fleet'), null);
  assert.equal(resolveTargetRepo('whichllm'), null);

  // Unknown target returns null
  assert.equal(resolveTargetRepo('unmapped-domain-xyz'), null);

  // ICF server resolver behaves identically
  assert.equal(serverResolveTargetRepo(null), null);
  assert.equal(serverResolveTargetRepo(''), null);
  assert.equal(serverResolveTargetRepo('cic-kb'), null);
  assert.equal(serverResolveTargetRepo('sigil'), 'sorensencc-dotcom/sigil');
});

test('Routing Gate: promoteCard throws explicit error when target has no mapped repository', () => {
  const tmpDir = createTempDir('gate-test');
  const testCardPath = path.join(tmpDir, 'act-unmapped.md');
  fs.writeFileSync(testCardPath, `---
id: act-unmapped
target: cic-kb
intent: test_unmapped_promotion
category: IMPLEMENT
---
Detailed card content here.
`, 'utf8');

  try {
    assert.throws(
      () => promoteCard(testCardPath),
      /CANNOT_PROMOTE_RESEARCH: Target 'cic-kb' is a local research topic/
    );
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
});

test('Routing Gate: resolveLocalRepoDir strictly requires valid repo and supports owner slug prefix', () => {
  assert.equal(resolveLocalRepoDir(null), null);
  assert.equal(resolveLocalRepoDir(''), null);
  assert.equal(resolveLocalRepoDir('cic-kb'), null);
  assert.equal(resolveLocalRepoDir('research'), null);

  // Known repos resolve to valid existing paths
  const sigilDir = resolveLocalRepoDir('sigil');
  assert.ok(sigilDir && fs.existsSync(sigilDir));

  // Full owner/repo slug resolves properly
  const sigilFullSlugDir = resolveLocalRepoDir('sorensencc-dotcom/sigil');
  assert.equal(sigilFullSlugDir, sigilDir);

  const kbSyncDir = resolveLocalRepoDir('kb-sync');
  assert.ok(kbSyncDir && fs.existsSync(kbSyncDir));

  const kbSyncFullSlugDir = resolveLocalRepoDir('sorensencc-dotcom/kb-sync');
  assert.equal(kbSyncFullSlugDir, kbSyncDir);
});

test('Card Parser Gate: parseCardFile & updateCardFrontmatter support JSON-formatted action cards', () => {
  const tmpDir = createTempDir('json-card-test');
  const jsonCardPath = path.join(tmpDir, 'act-json-test.json');
  const initialData = {
    id: 'act-json-test',
    target: 'sigil',
    intent: 'harden_parser_support',
    priority: 'P1',
    body: 'Test JSON action card body directives with comprehensive instructions for the agent.'
  };
  fs.writeFileSync(jsonCardPath, JSON.stringify(initialData, null, 2), 'utf8');

  try {
    const parsed = parseCardFile(jsonCardPath);
    assert.equal(parsed.isJson, true);
    assert.equal(parsed.frontmatter.id, 'act-json-test');
    assert.equal(parsed.frontmatter.target, 'sigil');
    assert.equal(parsed.body, initialData.body);

    const updated = updateCardFrontmatter(jsonCardPath, {
      issue_url: 'https://github.com/sorensencc-dotcom/sigil/issues/999',
      status: 'PROMOTED'
    });
    assert.equal(updated, true);

    const reRead = JSON.parse(fs.readFileSync(jsonCardPath, 'utf8'));
    assert.equal(reRead.issue_url, 'https://github.com/sorensencc-dotcom/sigil/issues/999');
    assert.equal(reRead.status, 'PROMOTED');
    assert.equal(reRead.target, 'sigil');
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
});

test('Card In-Progress Lifecycle: loadCardData discovers tasks in .harness/tasks/in-progress', () => {
  const testCardId = 'act-inprogress-fixture';

  const foundCard = loadCardData(testCardId);
  assert.ok(foundCard, 'loadCardData should discover card in .harness/tasks/in-progress');
  assert.equal(foundCard.id, testCardId);
  assert.equal(foundCard.status, 'IN_PROGRESS');

  const archivedFound = loadArchivedCard(testCardId);
  assert.ok(archivedFound, 'loadArchivedCard in server.mjs should discover card in in-progress');
  assert.equal(archivedFound.id, testCardId);
});

test('Ingress Gate Live Validation: processFile quarantines stub/empty card in dryRun', async () => {
  const tmpDir = createTempDir('ingress-gate-test');
  const stubCardPath = path.join(tmpDir, 'stub-card.json');
  fs.writeFileSync(stubCardPath, JSON.stringify({
    id: 'act-stub-ingress',
    source: 'mobile',
    intent: 'triage_mobile_request',
    title: 'Unknown Title',
    summary: 'too short'
  }), 'utf8');

  try {
    const result = await processFile(stubCardPath, { dryRun: true });
    assert.ok(result);
    assert.equal(result.status, 'QUARANTINED_INSUFFICIENT_DATA');
    assert.ok(result.error.includes('too short') || result.error.includes('synthetic/stub'));
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
});
