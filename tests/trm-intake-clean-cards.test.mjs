import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  validateCardIntegrity,
  validateIngressQuality,
  processFile
} from '../scripts/trm-ingress-watcher.mjs';
import { generateTestScaffold, stagePr } from '../scripts/trm-stage-pr.mjs';
import { promoteCard } from '../scripts/trm-promote-card.mjs';

const VALID_BODY = 'Implement the bounded retry behavior and add regression coverage for the failure path.';
const VALID_CRITERIA = [
  'Retry count never exceeds three attempts.',
  'A node:test regression proves the failed path.'
];

function validCard(overrides = {}) {
  return {
    id: 'act-clean-card-001',
    source: 'mobile-gemini',
    action_type: 'antigravity_triage',
    intent: 'implement_bounded_retry',
    target: 'sigil',
    domain: 'sigil',
    target_notebook_name: 'SIGIL',
    body: VALID_BODY,
    acceptance_criteria: VALID_CRITERIA,
    ...overrides
  };
}

test('validator rejects empty or filename-only body extraction with BODY_EXTRACTION_FAILED', () => {
  assert.deepEqual(
    validateCardIntegrity(validCard({ body: '' })),
    { valid: false, reason: 'BODY_EXTRACTION_FAILED', error: 'Document body extraction failed' }
  );

  assert.equal(
    validateCardIntegrity(validCard({ body: '2026-11-04T120000Z__action__sigil__act-clean-card-001.gdoc' })).reason,
    'BODY_EXTRACTION_FAILED'
  );
});

test('validator rejects generic acceptance defaults with NO_ACCEPTANCE_CRITERIA', () => {
  const result = validateCardIntegrity(validCard({
    acceptance_criteria: [
      'Technical directives implemented according to specifications',
      'Implements requirements according to specifications'
    ]
  }));
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'NO_ACCEPTANCE_CRITERIA');
});

test('validator rejects case-insensitive duplicate IDs with DUPLICATE_ID', () => {
  const result = validateCardIntegrity(validCard({ id: 'act-sigil-chief-daemon-logon-task-watchdog' }), {
    existingIds: ['ACT-SIGIL-CHIEF-DAEMON-LOGON-TASK-WATCHDOG']
  });
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'DUPLICATE_ID');
});

test('validator rejects inconsistent issue, repo, and target routing with REPO_MISMATCH', () => {
  const result = validateCardIntegrity(validCard({
    id: 'act-03-evaluate-patch-gap-dependency-scanner',
    issue_url: 'https://github.com/sorensencc-dotcom/kb-sync/issues/146',
    repo: 'sorensencc-dotcom/rewrite-mcp',
    target: 'rewrite-mcp',
    domain: 'rewrite-mcp',
    target_notebook_name: 'REWRITE-MCP'
  }));
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'REPO_MISMATCH');
});

test('intake quarantines a failed lowercase mobile-gemini-gdoc body extraction fixture', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trm-clean-gdoc-'));
  const cardPath = path.join(dir, '2026-11-04T120000Z__action__sigil__act-lowercase-mobile-gemini-gdoc.md.gdoc');
  fs.writeFileSync(cardPath, JSON.stringify({ doc_id: 'fixture-no-network-doc' }), 'utf8');
  try {
    const result = await processFile(cardPath, {
      dryRun: true,
      useSmallModel: false,
      docFetcher: async () => ({ ok: false, error: 'fixture fetch failed' })
    });
    assert.equal(result.status, 'QUARANTINED_INSUFFICIENT_DATA');
    assert.equal(result.reason, 'BODY_EXTRACTION_FAILED');
    assert.match(result.error, /Document body extraction failed/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('staging rejects cards without real acceptance criteria before generating a scaffold', () => {
  assert.throws(
    () => generateTestScaffold(validCard({ acceptance_criteria: undefined })),
    /NO_ACCEPTANCE_CRITERIA/
  );
});

test('promotion rejects a repository-mismatched card before calling GitHub', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trm-clean-promote-'));
  const cardPath = path.join(dir, 'act-rewritemcp-dispatcher-worker-relay-conformance.json');
  fs.writeFileSync(cardPath, JSON.stringify(validCard({
    id: 'act-rewritemcp-dispatcher-worker-relay-conformance',
    issue_url: 'https://github.com/sorensencc-dotcom/sigil/issues/171',
    target: 'rewrite-mcp',
    domain: 'rewrite-mcp',
    target_notebook_name: 'REWRITE-MCP'
  })), 'utf8');
  try {
    assert.throws(
      () => promoteCard(cardPath, { dryRun: true }),
      /REPO_MISMATCH/
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('staging rejects a case-insensitive duplicate card ID', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trm-clean-stage-'));
  const cardPath = path.join(dir, 'act-sigil-chief-daemon-logon-task-watchdog.json');
  const ledgerPath = path.join(dir, 'ledger.jsonl');
  fs.writeFileSync(cardPath, JSON.stringify(validCard({
    id: 'act-sigil-chief-daemon-logon-task-watchdog'
  })), 'utf8');
  fs.writeFileSync(ledgerPath, JSON.stringify({ id: 'ACT-SIGIL-CHIEF-DAEMON-LOGON-TASK-WATCHDOG' }) + '\n', 'utf8');
  try {
    assert.throws(
      () => stagePr('act-sigil-chief-daemon-logon-task-watchdog', { inboxDir: dir, ledgerPath, dryRun: true }),
      /DUPLICATE_ID/
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('existing quality gate remains compatible with substantive content', () => {
  assert.equal(validateIngressQuality(validCard()).valid, true);
});
