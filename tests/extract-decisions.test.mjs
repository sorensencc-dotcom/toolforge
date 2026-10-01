import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execSync } from 'node:child_process';
import {
  computeDecisionFingerprint,
  validateDecisionRecord,
  extractDecisionsFromText,
  stageDecisionsToBacklog
} from '../scripts/extract-decisions.mjs';

test('computeDecisionFingerprint produces deterministic hashes', () => {
  const hash1 = computeDecisionFingerprint('Migrate database to PG15', 'chris');
  const hash2 = computeDecisionFingerprint('Migrate database to PG15', 'chris');
  const hash3 = computeDecisionFingerprint('Different decision', 'chris');

  assert.equal(hash1, hash2);
  assert.notEqual(hash1, hash3);
  assert.equal(typeof hash1, 'string');
  assert.equal(hash1.length, 16);
});

test('validateDecisionRecord enforces strict schema contracts', () => {
  // 1. Valid record
  const valid = validateDecisionRecord({
    decision: 'Enforce pre-commit egress security gate on all fleet daemons',
    owner: 'sorensencc',
    target_deadline: '2026-10-15',
    verification_gate: 'node --test tests/agent-egress-guard.test.mjs passes with 0 failures',
    priority: 'P1'
  });
  assert.equal(valid.valid, true);
  assert.equal(valid.errors.length, 0);

  // 2. Reject missing owner or unassigned
  const missingOwner = validateDecisionRecord({
    decision: 'Enforce pre-commit egress security gate on all fleet daemons',
    owner: 'unassigned',
    target_deadline: '2026-10-15',
    verification_gate: 'npm test passes'
  });
  assert.equal(missingOwner.valid, false);
  assert.ok(missingOwner.errors.some(e => e.includes('Owner')));

  // 3. Reject vague deadlines (ASAP, soon, later)
  const vagueDeadline = validateDecisionRecord({
    decision: 'Enforce pre-commit egress security gate on all fleet daemons',
    owner: 'chris',
    target_deadline: 'ASAP',
    verification_gate: 'npm test passes'
  });
  assert.equal(vagueDeadline.valid, false);
  assert.ok(vagueDeadline.errors.some(e => e.includes('ambiguous')));

  // 4. Reject missing verification gate
  const missingGate = validateDecisionRecord({
    decision: 'Enforce pre-commit egress security gate on all fleet daemons',
    owner: 'chris',
    target_deadline: '2026-10-15',
    verification_gate: ''
  });
  assert.equal(missingGate.valid, false);
  assert.ok(missingGate.errors.some(e => e.includes('Verification gate')));
});

test('extractDecisionsFromText extracts pipe-delimited meeting items', () => {
  const transcript = `
# Executive Sync 2026-10-01

Discussion on infrastructure and fleet security.

## Actionable Decisions
- Decision: Migrate CIC Ingestion pipeline to streaming chunking | Owner: data-team | Deadline: 2026-10-20 | Gate: Streaming benchmark < 100ms
- Decision: Harden agent intermediate storage scratchpads | Owner: security-bot | Deadline: 2026-10-05 | Gate: 100% egress tests pass
  `;

  const extracted = extractDecisionsFromText(transcript);
  assert.equal(extracted.length, 2);

  assert.equal(extracted[0].decision, 'Migrate CIC Ingestion pipeline to streaming chunking');
  assert.equal(extracted[0].owner, 'data-team');
  assert.equal(extracted[0].target_deadline, '2026-10-20');
  assert.equal(extracted[0].verification_gate, 'Streaming benchmark < 100ms');

  assert.equal(extracted[1].decision, 'Harden agent intermediate storage scratchpads');
  assert.equal(extracted[1].owner, 'security-bot');
  assert.equal(extracted[1].target_deadline, '2026-10-05');
});

test('extractDecisionsFromText extracts key-value blocks', () => {
  const notes = `
Meeting Notes: Architecture Review

Decision: Establish local SQLite FTS5 index for wiki properties
Owner: kb-sentinel
Deadline: 2026-10-12
Gate: FTS5 query latency < 10ms
Priority: P1
  `;

  const extracted = extractDecisionsFromText(notes);
  assert.equal(extracted.length, 1);
  assert.equal(extracted[0].decision, 'Establish local SQLite FTS5 index for wiki properties');
  assert.equal(extracted[0].owner, 'kb-sentinel');
  assert.equal(extracted[0].target_deadline, '2026-10-12');
  assert.equal(extracted[0].priority, 'P1');
  assert.equal(extracted[0].verification_gate, 'FTS5 query latency < 10ms');
});

test('stageDecisionsToBacklog writes cards and prevents duplicates', () => {
  const tmpDir = path.join(os.tmpdir(), `trm-decisions-test-${Date.now()}`);
  const ledgerPath = path.join(tmpDir, 'decisions.jsonl');

  const sampleDecisions = [
    {
      id: 'dec-test-01',
      decision: 'Deploy TRM daemon loop with 5 minute sync intervals',
      owner: 'sorensencc',
      target_deadline: '2026-10-02',
      verification_gate: 'node scripts/trm-ingress-watcher.mjs --status returns 0',
      priority: 'P2'
    },
    {
      id: 'dec-invalid-02',
      decision: 'Vague task',
      owner: 'unassigned',
      target_deadline: 'soon',
      verification_gate: 'none'
    }
  ];

  // First staging: 1 valid, 1 invalid
  const res1 = stageDecisionsToBacklog(sampleDecisions, { targetDir: tmpDir, ledgerPath });
  assert.equal(res1.stagedCount, 1);
  assert.equal(res1.invalidSkipped, 1);
  assert.equal(res1.duplicatesSkipped, 0);

  assert.ok(fs.existsSync(path.join(tmpDir, 'dec-test-01.md')));
  assert.ok(fs.existsSync(ledgerPath));

  // Second staging: duplicate should be skipped
  const res2 = stageDecisionsToBacklog(sampleDecisions, { targetDir: tmpDir, ledgerPath });
  assert.equal(res2.stagedCount, 0);
  assert.equal(res2.duplicatesSkipped, 1);
  assert.equal(res2.invalidSkipped, 1);

  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
});

test('CLI extract-decisions runs cleanly', () => {
  const scriptPath = path.resolve('scripts/extract-decisions.mjs');
  const sample = "- Decision: Add typed verification tests | Owner: dev-team | Deadline: 2026-10-30 | Gate: npm test passes";
  const output = execSync(`node "${scriptPath}" "${sample}"`, { encoding: 'utf8' });
  assert.ok(output.includes('Add typed verification tests'));
  assert.ok(output.includes('dev-team'));
});
