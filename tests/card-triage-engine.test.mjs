import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import {
  triageCard,
  detectCompletedTask,
  evaluateYagni,
  draftIssuePayload,
  classifyReversibility
} from '../modules/triage/card-triage-engine.mjs';

test('detectCompletedTask - returns completion record if task exists in completed tasks dir', () => {
  const completedDir = path.join(os.tmpdir(), `test-completed-${Date.now()}`);
  fs.mkdirSync(completedDir, { recursive: true });

  const completedCard = {
    id: 'act-20261003-viking-context-compaction',
    status: 'COMPLETED',
    intent: 'implement_viking_filesystem_tiering_and_context_compaction',
    context: { resolution: 'Implemented offline compaction generator' }
  };
  fs.writeFileSync(path.join(completedDir, `${completedCard.id}.json`), JSON.stringify(completedCard), 'utf8');

  try {
    const match = detectCompletedTask(
      { id: 'act-20261003-viking-context-compaction', intent: 'viking_context_compaction' },
      { completedDir }
    );
    assert.ok(match, 'Should find completed task');
    assert.equal(match.status, 'COMPLETED');
    assert.equal(match.id, 'act-20261003-viking-context-compaction');
  } finally {
    fs.rmSync(completedDir, { recursive: true, force: true });
  }
});

test('evaluateYagni - identifies speculative UI animation or over-engineering cards', () => {
  const motionCard = {
    id: 'act-02-claude-dashboard-motion-exporter',
    intent: 'claude_dashboard_motion_exporter',
    summary: 'Export motion design animation keyframes for Claude dashboard'
  };
  const result = evaluateYagni(motionCard);
  assert.equal(result.isYagni, true);
  assert.equal(result.status, 'DEFERRED_YAGNI');
  assert.ok(result.reason.includes('speculative UI animation') || result.reason.includes('YAGNI'));

  const coreCard = {
    id: 'act-01-one-way-door-action-gates',
    intent: 'one_way_door_action_gates',
    summary: 'Implement execution gates for irreversible tool actions'
  };
  const coreResult = evaluateYagni(coreCard);
  assert.equal(coreResult.isYagni, false);
});

test('classifyReversibility - categorizes tool and action reversibility', () => {
  assert.equal(classifyReversibility({ intent: 'delete_file_permanently', category: 'IMPLEMENT' }), 'IRREVERSIBLE');
  assert.equal(classifyReversibility({ intent: 'git_push_remote', category: 'IMPLEMENT' }), 'IRREVERSIBLE');
  assert.equal(classifyReversibility({ intent: 'publish_package', category: 'IMPLEMENT' }), 'IRREVERSIBLE');
  assert.equal(classifyReversibility({ intent: 'truncate_orders', category: 'IMPLEMENT' }), 'IRREVERSIBLE');
  assert.equal(classifyReversibility({ intent: 'write_note', path: 'scratch/notes.txt', category: 'IMPLEMENT' }), 'BOUNDED');
  assert.equal(classifyReversibility({ intent: 'undelete_comment', category: 'IMPLEMENT' }), 'REVERSIBLE');
  assert.equal(classifyReversibility({ intent: 'evaluate_copilot_architecture', category: 'EVALUATE' }), 'REVERSIBLE');
  assert.equal(classifyReversibility({ intent: 'research_store_hybrid_supabase', category: 'RESEARCH' }), 'REVERSIBLE');
});

test('detectCompletedTask matches a completed record by intent when the id file is absent', () => {
  const completedDir = path.join(os.tmpdir(), `test-completed-intent-${Date.now()}`);
  fs.mkdirSync(completedDir, { recursive: true });
  fs.writeFileSync(path.join(completedDir, 'other-name.json'), JSON.stringify({
    id: 'other-name',
    intent: 'shared_intent',
    status: 'COMPLETED'
  }), 'utf8');
  try {
    const match = detectCompletedTask(
      { id: 'missing-id', intent: 'shared_intent' },
      { completedDir }
    );
    assert.ok(match);
    assert.equal(match.id, 'other-name');
    assert.equal(match.status, 'COMPLETED');
  } finally {
    fs.rmSync(completedDir, { recursive: true, force: true });
  }
});

test('detectCompletedTask rejects card ids that escape the completed directory', () => {
  const completedDir = path.join(os.tmpdir(), `test-completed-escape-${Date.now()}`);
  fs.mkdirSync(completedDir, { recursive: true });
  try {
    assert.equal(detectCompletedTask({ id: '../secret' }, { completedDir }), null);
    assert.equal(detectCompletedTask({ id: 'nested/id' }, { completedDir }), null);
    assert.equal(detectCompletedTask({ id: 'nested\\id' }, { completedDir }), null);
  } finally {
    fs.rmSync(completedDir, { recursive: true, force: true });
  }
});

test('draftIssuePayload - generates standard GitHub issue title, repo, body, and labels', () => {
  const card = {
    id: 'act-01-one-way-door-action-gates',
    domain: 'toolforge',
    category: 'IMPLEMENT',
    priority: 'P1',
    intent: 'one_way_door_action_gates',
    summary: 'Implement one-way door action classifier and execution gates in Toolforge'
  };

  const payload = draftIssuePayload(card);
  assert.equal(payload.repo, 'sorensencc-dotcom/toolforge');
  assert.match(payload.title, /^\[TRM-Triage\]\s+\[P1\]\s+\[IMPLEMENT\]/);
  assert.ok(payload.body.includes('## Context'));
  assert.ok(payload.body.includes('## Acceptance Criteria'));
  assert.deepEqual(payload.labels, ['enhancement', 'governance']);
});

test('triageCard - orchestrates end-to-end triage decision', () => {
  const newCard = {
    id: 'act-kbsync-chat-injection-staleness-entropy-fail',
    domain: 'kb-sync',
    category: 'RESEARCH',
    priority: 'P2',
    intent: 'act_kbsync_chat_injection_staleness_entropy_fail',
    summary: 'Investigation into context entropy degradation and cache refresh failures'
  };

  const triaged = triageCard(newCard);
  assert.equal(triaged.status, 'STAGED_FOR_RESEARCH');
  assert.equal(triaged.priority, 'P2');
  assert.equal(triaged.reversibility, 'REVERSIBLE');
  assert.ok(triaged.issueDraft);
  assert.equal(triaged.issueDraft.repo, 'sorensencc-dotcom/toolforge');
});
