import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  resolveTargetRepo,
  commitTypeForCard,
  formatIssueBody,
  promoteCard,
  updateCardFrontmatter,
  updateLedgerRow
} from '../scripts/trm-promote-card.mjs';

test('resolveTargetRepo correctly maps known domains and handles custom pass-through', () => {
  assert.equal(resolveTargetRepo('sigil'), 'sorensencc-dotcom/sigil');
  assert.equal(resolveTargetRepo('toolforge'), 'sorensencc-dotcom/toolforge');
  assert.equal(resolveTargetRepo('kb-sync'), 'sorensencc-dotcom/kb-sync');
  assert.equal(resolveTargetRepo('IronLedger'), 'sorensencc-dotcom/IronLedger');
  assert.equal(resolveTargetRepo('rewrite-mcp'), 'sorensencc-dotcom/rewrite-mcp');
  assert.equal(resolveTargetRepo('my-org/my-repo'), 'my-org/my-repo');
});

test('commitTypeForCard assigns correct conventional commit prefix', () => {
  assert.equal(commitTypeForCard({ category: 'RESEARCH' }), 'chore');
  assert.equal(commitTypeForCard({ category: 'EVALUATE' }), 'chore');
  assert.equal(commitTypeForCard({ action_type: 'deterministic_fix' }), 'fix');
  assert.equal(commitTypeForCard({ direction: 'BUG_FIX' }), 'fix');
  assert.equal(commitTypeForCard({ category: 'FEATURE', direction: 'NEW_IMPLEMENTATION' }), 'feat');
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

  // Verify idempotency guard blocks duplicate promotion
  assert.throws(() => {
    promoteCard(cardPath, { dryRun: true, ledgerPath });
  }, /ALREADY_PROMOTED/);

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
