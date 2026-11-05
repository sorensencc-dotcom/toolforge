import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  DEFAULT_REPO_MAP,
  resolveTargetRepo,
  commitTypeForCard,
  parseCardFile,
  formatIssueBody,
  promoteCard,
  updateCardFrontmatter,
  updateLedgerRow
} from '../scripts/trm-promote-card.mjs';

test('resolveTargetRepo correctly maps known domains and handles custom pass-through', () => {
  // Hardened behavior: no default fallback to toolforge when empty / null
  assert.equal(resolveTargetRepo(null), null);
  assert.equal(resolveTargetRepo(''), null);
  assert.equal(resolveTargetRepo(undefined), null);

  // Known repository mappings
  assert.equal(resolveTargetRepo('sigil'), 'sorensencc-dotcom/sigil');
  assert.equal(resolveTargetRepo('toolforge'), 'sorensencc-dotcom/toolforge');
  assert.equal(resolveTargetRepo('kb-sync'), 'sorensencc-dotcom/kb-sync');
  assert.equal(resolveTargetRepo('rewrite'), 'sorensencc-dotcom/rewrite-mcp');
  assert.equal(resolveTargetRepo('rewrite-mcp'), 'sorensencc-dotcom/rewrite-mcp');
  assert.equal(resolveTargetRepo('ironledger'), 'sorensencc-dotcom/IronLedger');
  assert.equal(resolveTargetRepo('IronLedger'), 'sorensencc-dotcom/IronLedger');

  // Case-insensitive lookup
  assert.equal(resolveTargetRepo('SIGIL'), 'sorensencc-dotcom/sigil');
  assert.equal(resolveTargetRepo('TOOLFORGE'), 'sorensencc-dotcom/toolforge');
  assert.equal(resolveTargetRepo('Kb-Sync'), 'sorensencc-dotcom/kb-sync');

  // Pass-through with slash
  assert.equal(resolveTargetRepo('my-org/my-repo'), 'my-org/my-repo');
  assert.equal(resolveTargetRepo('upstream/project'), 'upstream/project');

  // Unmapped target returns null (requires explicit mapping or slash)
  assert.equal(resolveTargetRepo('custom-service'), null);

  // Custom map override and extension
  assert.equal(resolveTargetRepo('custom', { custom: 'org/custom' }), 'org/custom');
  assert.equal(resolveTargetRepo('sigil', { sigil: 'custom-org/sigil-fork' }), 'custom-org/sigil-fork');
});

test('commitTypeForCard assigns correct conventional commit prefix', () => {
  // Null or empty card defaults to feat
  assert.equal(commitTypeForCard(), 'feat');
  assert.equal(commitTypeForCard({}), 'feat');

  // Fix types
  assert.equal(commitTypeForCard({ action_type: 'deterministic_fix' }), 'fix');
  assert.equal(commitTypeForCard({ direction: 'BUG_FIX' }), 'fix');
  assert.equal(commitTypeForCard({ direction: 'FIX_ERROR' }), 'fix');
  assert.equal(commitTypeForCard({ direction: 'SOLVE_BUG' }), 'fix');

  // Chore types
  assert.equal(commitTypeForCard({ category: 'RESEARCH' }), 'chore');
  assert.equal(commitTypeForCard({ category: 'EVALUATE' }), 'chore');
  assert.equal(commitTypeForCard({ direction: 'UPDATE_DOCS' }), 'chore');
  assert.equal(commitTypeForCard({ direction: 'SECURITY_AUDIT' }), 'chore');

  // Feat types
  assert.equal(commitTypeForCard({ category: 'FEATURE', direction: 'NEW_IMPLEMENTATION' }), 'feat');
  assert.equal(commitTypeForCard({ category: 'CORE', direction: 'OPTIMIZE' }), 'feat');
});

test('parseCardFile parses frontmatter and body accurately', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parse-card-test-'));
  const cardPath = path.join(tmpDir, 'valid-card.md');
  const cardContent = `---
id: act-sample-01
title: Fix: broken pipeline retry logic
target: kb-sync
category: EVALUATE
url: https://github.com/example/issue/1
---

## Technical Directive
Ensure retry count is capped at 3.
`;
  fs.writeFileSync(cardPath, cardContent, 'utf8');

  const parsed = parseCardFile(cardPath);
  assert.equal(parsed.frontmatter.id, 'act-sample-01');
  assert.equal(parsed.frontmatter.title, 'Fix: broken pipeline retry logic');
  assert.equal(parsed.frontmatter.target, 'kb-sync');
  assert.equal(parsed.frontmatter.category, 'EVALUATE');
  assert.equal(parsed.frontmatter.url, 'https://github.com/example/issue/1');
  assert.ok(parsed.body.includes('## Technical Directive'));
  assert.ok(parsed.body.includes('Ensure retry count is capped at 3.'));

  // Test missing file throws
  assert.throws(() => {
    parseCardFile(path.join(tmpDir, 'non-existent.md'));
  }, /Action card file not found/);

  // Test missing frontmatter throws
  const invalidCard = path.join(tmpDir, 'invalid-card.md');
  fs.writeFileSync(invalidCard, '# No frontmatter\nJust content.', 'utf8');
  assert.throws(() => {
    parseCardFile(invalidCard);
  }, /Action card missing YAML frontmatter/);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('formatIssueBody constructs compliant markdown issue specification', () => {
  const cardData = {
    id: 'act-audit-101',
    domain: 'sigil',
    priority: 'P1',
    title: 'Audit room bridge encryption',
    summary: 'Verify room cipher integrity and session rotation.',
    source: 'TRM Review Queue',
    created: '2026-10-17T12:00:00Z'
  };

  const parsedCard = {
    body: 'Detailed technical specification and directives.'
  };

  const formatted = formatIssueBody(cardData, parsedCard);
  assert.ok(formatted.includes('### Overview\nVerify room cipher integrity and session rotation.'));
  assert.ok(formatted.includes('- Card ID: `act-audit-101`'));
  assert.ok(formatted.includes('- Target: `sigil`'));
  assert.ok(formatted.includes('- Priority: `P1`'));
  assert.ok(formatted.includes('- Source: `TRM Review Queue`'));
  assert.ok(formatted.includes('### PR & Issue Traceability'));
  assert.ok(formatted.includes('feat(sigil): Audit room bridge encryption'));
  assert.ok(formatted.includes('### Technical Specifications & Directives\nDetailed technical specification and directives.'));
  assert.ok(formatted.includes('### Acceptance Criteria'));

  // Fallback defaults formatting
  const minimalFormatted = formatIssueBody({});
  assert.ok(minimalFormatted.includes('- Card ID: `unknown`'));
  assert.ok(minimalFormatted.includes('- Target: `core`'));
  assert.ok(minimalFormatted.includes('- Priority: `P2`'));
  assert.ok(minimalFormatted.includes('- Source: `TRM Mobile Ingress`'));
});

test('updateCardFrontmatter updates existing keys and appends new keys cleanly', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'frontmatter-test-'));
  const cardPath = path.join(tmpDir, 'card.md');
  const initial = `---
id: act-001
status: PENDING
target: toolforge
---

Body paragraph here.
`;
  fs.writeFileSync(cardPath, initial, 'utf8');

  // Update status and add issue_url
  const success = updateCardFrontmatter(cardPath, {
    status: 'PROMOTED',
    issue_url: 'https://github.com/sorensencc-dotcom/toolforge/issues/100'
  });
  assert.equal(success, true);

  const updated = fs.readFileSync(cardPath, 'utf8');
  assert.ok(updated.includes('status: PROMOTED'));
  assert.ok(updated.includes('issue_url: https://github.com/sorensencc-dotcom/toolforge/issues/100'));
  assert.ok(updated.includes('id: act-001'));
  assert.ok(updated.includes('target: toolforge'));
  assert.ok(updated.includes('Body paragraph here.'));

  // Non-existent card returns false
  assert.equal(updateCardFrontmatter(path.join(tmpDir, 'none.md'), { status: 'PROMOTED' }), false);

  // Missing frontmatter returns false
  const noFmCard = path.join(tmpDir, 'no-fm.md');
  fs.writeFileSync(noFmCard, 'Plain text only', 'utf8');
  assert.equal(updateCardFrontmatter(noFmCard, { status: 'PROMOTED' }), false);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('updateLedgerRow updates existing rows and appends new rows safely', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-test-'));
  const ledgerPath = path.join(tmpDir, 'ledger.jsonl');

  const row1 = { id: 'act-1', status: 'PENDING', target: 'toolforge' };
  const row2 = { action_id: 'act-2', status: 'PENDING', target: 'sigil' };
  fs.writeFileSync(ledgerPath, `${JSON.stringify(row1)}\n${JSON.stringify(row2)}\n`, 'utf8');

  // Update row by id
  const res1 = updateLedgerRow(ledgerPath, 'act-1', { status: 'PROMOTED', issue_url: 'https://github.com/issue/1' });
  assert.equal(res1, true);

  // Update row by action_id
  const res2 = updateLedgerRow(ledgerPath, 'act-2', { status: 'PROMOTED', issue_url: 'https://github.com/issue/2' });
  assert.equal(res2, true);

  // Append new row for unknown id
  const res3 = updateLedgerRow(ledgerPath, 'act-3', { status: 'PROMOTED', issue_url: 'https://github.com/issue/3' });
  assert.equal(res3, true);

  const lines = fs.readFileSync(ledgerPath, 'utf8').trim().split('\n').map(l => JSON.parse(l));
  assert.equal(lines.length, 3);
  assert.equal(lines[0].status, 'PROMOTED');
  assert.equal(lines[0].issue_url, 'https://github.com/issue/1');
  assert.equal(lines[1].status, 'PROMOTED');
  assert.equal(lines[1].issue_url, 'https://github.com/issue/2');
  assert.equal(lines[2].id, 'act-3');
  assert.equal(lines[2].status, 'PROMOTED');
  assert.ok(lines[2].created_at);

  // Non-existent ledger returns false
  assert.equal(updateLedgerRow(path.join(tmpDir, 'missing.jsonl'), 'act-1'), false);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('promoteCard executes atomic two-phase promotion with mock gh runner', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'promote-test-'));
  const cardPath = path.join(tmpDir, 'test-card.md');
  const ledgerPath = path.join(tmpDir, 'ledger.jsonl');

  const cardContent = `---
id: act-test-card-123
title: Test Atomic Promotion
target: toolforge
category: EVALUATE
priority: HIGH
---

# Test Atomic Promotion
Directive body content.
`;
  fs.writeFileSync(cardPath, cardContent, 'utf8');
  fs.writeFileSync(ledgerPath, JSON.stringify({ id: 'act-test-card-123', status: 'PENDING' }) + '\n', 'utf8');

  const res = promoteCard(cardPath, {
    dryRun: true,
    ledgerPath,
    mockIssueUrl: 'https://github.com/sorensencc-dotcom/toolforge/issues/999'
  });

  assert.equal(res.ok, true);
  assert.equal(res.issueUrl, 'https://github.com/sorensencc-dotcom/toolforge/issues/999');

  // Verify card frontmatter updated
  const updatedCard = fs.readFileSync(cardPath, 'utf8');
  assert.ok(updatedCard.includes('issue_url: https://github.com/sorensencc-dotcom/toolforge/issues/999'));
  assert.ok(updatedCard.includes('status: PROMOTED'));
  assert.ok(updatedCard.includes('promoted_at:'));

  // Verify ledger updated
  const updatedLedger = fs.readFileSync(ledgerPath, 'utf8');
  const row = JSON.parse(updatedLedger.trim());
  assert.equal(row.id, 'act-test-card-123');
  assert.equal(row.status, 'PROMOTED');
  assert.equal(row.issue_url, 'https://github.com/sorensencc-dotcom/toolforge/issues/999');

  // Verify idempotency guard blocks duplicate promotion in frontmatter
  assert.throws(() => {
    promoteCard(cardPath, { dryRun: true, ledgerPath });
  }, /ALREADY_PROMOTED/);

  // Verify force flag bypasses frontmatter idempotency guard
  const forceRes = promoteCard(cardPath, {
    dryRun: true,
    force: true,
    ledgerPath,
    mockIssueUrl: 'https://github.com/sorensencc-dotcom/toolforge/issues/1000'
  });
  assert.equal(forceRes.ok, true);
  assert.equal(forceRes.issueUrl, 'https://github.com/sorensencc-dotcom/toolforge/issues/1000');

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('promoteCard enforces ledger idempotency check unless force is set', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'promote-ledger-idempotency-'));
  const cardPath = path.join(tmpDir, 'card.md');
  const ledgerPath = path.join(tmpDir, 'ledger.jsonl');

  // Card does not have issue_url, but ledger does
  fs.writeFileSync(cardPath, `---\nid: act-ledger-dup\ntitle: Dup In Ledger\ntarget: sigil\n---\nBody\n`, 'utf8');
  fs.writeFileSync(ledgerPath, JSON.stringify({ id: 'act-ledger-dup', issue_url: 'https://github.com/issue/555' }) + '\n', 'utf8');

  assert.throws(() => {
    promoteCard(cardPath, { dryRun: true, ledgerPath });
  }, /ALREADY_PROMOTED_IN_LEDGER/);

  // Force bypasses ledger check
  const forced = promoteCard(cardPath, {
    dryRun: true,
    force: true,
    ledgerPath,
    mockIssueUrl: 'https://github.com/issue/777'
  });
  assert.equal(forced.ok, true);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('promoteCard ghRunner execution with label fallback retry', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'promote-label-retry-'));
  const cardPath = path.join(tmpDir, 'label-card.md');
  const ledgerPath = path.join(tmpDir, 'ledger.jsonl');

  fs.writeFileSync(cardPath, `---\nid: act-label-test\ntitle: Label Fallback Test\ntarget: kb-sync\n---\nBody\n`, 'utf8');
  fs.writeFileSync(ledgerPath, '', 'utf8');

  let callCount = 0;
  const mockGhRunner = (args) => {
    callCount++;
    if (callCount === 1) {
      // First call with label fails
      throw new Error('label non-existent-label not found on repository');
    }
    // Fallback retry without label succeeds
    return 'https://github.com/sorensencc-dotcom/kb-sync/issues/42\n';
  };

  const res = promoteCard(cardPath, {
    ledgerPath,
    labels: ['non-existent-label'],
    ghRunner: mockGhRunner
  });

  assert.equal(res.ok, true);
  assert.equal(res.issueUrl, 'https://github.com/sorensencc-dotcom/kb-sync/issues/42');
  assert.equal(callCount, 2);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('promoteCard rejects invalid non-HTTP issue URLs', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'promote-invalid-url-'));
  const cardPath = path.join(tmpDir, 'card.md');
  const ledgerPath = path.join(tmpDir, 'ledger.jsonl');

  fs.writeFileSync(cardPath, `---\nid: act-invalid-url\ntitle: Invalid URL\ntarget: rewrite\n---\nBody\n`, 'utf8');

  assert.throws(() => {
    promoteCard(cardPath, {
      ledgerPath,
      ghRunner: () => 'fatal: authentication failed\n'
    });
  }, /PROMOTION_FAILED: Invalid issue URL received/);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('promoteCard transactional rollback ensures zero disk mutation on gh failure', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'promote-fail-test-'));
  const cardPath = path.join(tmpDir, 'fail-card.md');
  const ledgerPath = path.join(tmpDir, 'ledger.jsonl');

  const originalCard = `---
id: act-fail-card
title: Test Failure Rollback
target: sigil
---

Original body content.
`;
  const originalLedger = JSON.stringify({ id: 'act-fail-card', status: 'PENDING' }) + '\n';
  fs.writeFileSync(cardPath, originalCard, 'utf8');
  fs.writeFileSync(ledgerPath, originalLedger, 'utf8');

  // Simulated gh runner that throws
  const failingGhRunner = () => {
    throw new Error('Command failed: gh issue create network error');
  };

  assert.throws(() => {
    promoteCard(cardPath, {
      ledgerPath,
      ghRunner: failingGhRunner
    });
  }, /Command failed: gh issue create/);

  // Assert card frontmatter was NOT mutated
  const currentCard = fs.readFileSync(cardPath, 'utf8');
  assert.equal(currentCard, originalCard);

  // Assert ledger was NOT mutated
  const currentLedger = fs.readFileSync(ledgerPath, 'utf8');
  assert.equal(currentLedger, originalLedger);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});
