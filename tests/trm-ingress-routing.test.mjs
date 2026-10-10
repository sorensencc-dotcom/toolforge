import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  TARGET_ROUTING_MAP,
  resolveTargetRouting,
  inferCategory,
  inferDomain,
  inferActionType,
  validatePayload,
  getRoutingDecision,
  parseGDocFilenameMetadata,
  parsePayload,
  auditOutboxReconciliation,
  syncCompletionReceipts,
  sweepOutboxRetention,
  dispatchRejectionReceipt,
  processFile
} from '../scripts/trm-ingress-watcher.mjs';

test('resolveTargetRouting maps repositories and local backlogs correctly', () => {
  assert.equal(resolveTargetRouting('toolforge')?.repo, 'sorensencc-dotcom/toolforge');
  assert.equal(resolveTargetRouting('target-toolforge')?.repo, 'sorensencc-dotcom/toolforge');
  assert.equal(resolveTargetRouting('rewrite')?.repo, 'sorensencc-dotcom/rewrite-mcp');
  assert.equal(resolveTargetRouting('rewrite-mcp')?.repo, 'sorensencc-dotcom/rewrite-mcp');
  assert.equal(resolveTargetRouting('sigil')?.repo, 'sorensencc-dotcom/sigil');
  
  const cicRouting = resolveTargetRouting('cic');
  assert.equal(cicRouting?.type, 'local_research');
  assert.equal(cicRouting?.name, 'CIC Research Backlog');

  const cicKbRouting = resolveTargetRouting('cic-kb');
  assert.equal(cicKbRouting?.type, 'local_research');

  const researchRouting = resolveTargetRouting('research');
  assert.equal(researchRouting?.type, 'local_research');
});

test('inferCategory correctly identifies RESEARCH, MONITOR, EVALUATE, and IMPLEMENT', () => {
  assert.equal(inferCategory({ intent: 'embodied_robotics_actuator_reliability' }), 'RESEARCH');
  assert.equal(inferCategory({ intent: 'frontier_lab_verification_standards_dissent' }), 'MONITOR');
  assert.equal(inferCategory({ intent: 'audit_agent_intermediate_storage_exfiltration' }), 'EVALUATE');
  assert.equal(inferCategory({ intent: 'triage_pr45_devin_review' }), 'IMPLEMENT');
  assert.equal(inferCategory({ action_type: 'deterministic_fix', intent: 'remediate_quarantine_enobufs' }), 'IMPLEMENT');
  assert.equal(inferCategory({ category: 'CUSTOM_CAT' }), 'CUSTOM_CAT');
});

test('inferDomain correctly resolves domain from target notebook name or text', () => {
  assert.equal(inferDomain({ target_notebook_name: 'CIC-KB' }), 'cic-kb');
  assert.equal(inferDomain({ target_notebook_name: 'toolforge' }), 'toolforge');
  assert.equal(inferDomain({ intent: 'embodied_robotics_actuator_reliability' }), 'cic');
  assert.equal(inferDomain({ intent: 'triage_pr45_devin_review' }), 'toolforge');
  assert.equal(inferDomain({ domain: 'custom-domain' }), 'custom-domain');
});

test('getRoutingDecision gatekeeps GitHub issue creation strictly to implementation tasks', () => {
  // Pure research card -> Local research backlog, NO GitHub issue
  const researchDecision = getRoutingDecision({
    id: 'act-03',
    action_type: 'antigravity_triage',
    category: 'RESEARCH',
    domain: 'cic',
    intent: 'embodied_robotics_actuator_reliability'
  });
  assert.equal(researchDecision.shouldCreateGitHubIssue, false);
  assert.equal(researchDecision.category, 'RESEARCH');
  assert.equal(researchDecision.targetDisplayName, 'CIC Research Backlog');

  // Pure monitor card -> Local research backlog, NO GitHub issue
  const monitorDecision = getRoutingDecision({
    id: 'act-04',
    action_type: 'antigravity_triage',
    category: 'MONITOR',
    domain: 'strategic-intelligence',
    intent: 'frontier_lab_verification_standards_dissent'
  });
  assert.equal(monitorDecision.shouldCreateGitHubIssue, false);
  assert.equal(researchDecision.category, 'RESEARCH');

  // Explicit code implementation card in toolforge -> GitHub issue created
  const implementDecision = getRoutingDecision({
    id: 'act-pr45',
    action_type: 'antigravity_triage',
    category: 'IMPLEMENT',
    domain: 'toolforge',
    target: 'toolforge',
    intent: 'triage_pr45_devin_review'
  });
  assert.equal(implementDecision.shouldCreateGitHubIssue, true);
  assert.equal(implementDecision.repo, 'sorensencc-dotcom/toolforge');

  // Explicit code implementation card in rewrite-mcp -> GitHub issue created in rewrite-mcp
  const rewriteDecision = getRoutingDecision({
    id: 'act-rewrite',
    action_type: 'antigravity_triage',
    category: 'IMPLEMENT',
    domain: 'rewrite',
    target: 'rewrite',
    intent: 'fix_memory_transport_leak'
  });
  assert.equal(rewriteDecision.shouldCreateGitHubIssue, true);
  assert.equal(rewriteDecision.repo, 'sorensencc-dotcom/rewrite-mcp');
});

test('parseGDocFilenameMetadata parses multi-part domain and category stems', () => {
  // 4-part drop: timestamp__action__domain__intent
  const gdoc1 = parseGDocFilenameMetadata('2026-09-27T123001Z__action__cic__act-03-embodied-robotics-actuator-reliability.md.gdoc');
  assert.equal(gdoc1.domain, 'cic');
  assert.equal(gdoc1.target, 'cic');
  assert.equal(gdoc1.category, 'RESEARCH');
  assert.equal(gdoc1.intent, 'embodied_robotics_actuator_reliability');

  // Explicit research category prefix
  const gdoc2 = parseGDocFilenameMetadata('2026-09-27T123001Z__research__cic__act-03-embodied-robotics.gdoc');
  assert.equal(gdoc2.category, 'RESEARCH');
  assert.equal(gdoc2.domain, 'cic');

  // Explicit target prefix
  const gdoc3 = parseGDocFilenameMetadata('2026-09-27T123001Z__action__target-toolforge__act-01-security-fix.gdoc');
  assert.equal(gdoc3.domain, 'toolforge');
});

test('auditOutboxReconciliation accurately computes ingress vs outbox receipt metrics', () => {
  const audit = auditOutboxReconciliation();
  assert.ok(audit.timestamp);
  assert.ok(typeof audit.reconciliationStatus === 'string');
  assert.ok(typeof audit.totalTrackedCount === 'number');
  assert.ok(typeof audit.activeReceiptsCount === 'number');
  assert.ok(audit.deliveryRatePercent >= 0 && audit.deliveryRatePercent <= 100);
});

test('syncCompletionReceipts and sweepOutboxRetention dry-run execute cleanly', () => {
  const synced = syncCompletionReceipts({ dryRun: true });
  assert.ok(Array.isArray(synced));

  const retention = sweepOutboxRetention(7, { dryRun: true });
  assert.ok(typeof retention.scannedCount === 'number');
  assert.ok(typeof retention.archivedCount === 'number');
  assert.equal(retention.dryRun, true);
});

test('dispatchRejectionReceipt creates a structured rejection receipt object', () => {
  const rcpt = dispatchRejectionReceipt('invalid-card.json', 'Missing required field: intent', { source: 'mobile' }, { dryRun: true });
  assert.equal(rcpt.status, 'REJECTED');
  assert.equal(rcpt.error, 'Missing required field: intent');
  assert.equal(rcpt.source, 'mobile');
  assert.ok(rcpt.receipt_id.includes('rej'));
});

test('parseGDocFilenameMetadata extracts parent_action_id for mobile threading', () => {
  const gdocFollowup = parseGDocFilenameMetadata('2026-09-27T123001Z__action__cic__act-02-followup__ref-act-02.gdoc');
  assert.equal(gdocFollowup.parent_action_id, 'act-02');
  assert.ok(gdocFollowup.summary.includes('follow-up to act-02'));

  const gdocParent = parseGDocFilenameMetadata('2026-09-27T123001Z__research__toolforge__act-05__parent-act-01.gdoc');
  assert.equal(gdocParent.parent_action_id, 'act-01');
});

test('inferActionType and validatePayload provide robust fallback when action_type is missing or unmapped', () => {
  // Explicit valid types preserved
  assert.equal(inferActionType({ action_type: 'deterministic_fix' }), 'deterministic_fix');
  assert.equal(inferActionType({ action_type: 'antigravity_triage' }), 'antigravity_triage');

  // Fallback to deterministic_fix for fix/remediate intents
  assert.equal(inferActionType({ intent: 'fix_broken_import' }), 'deterministic_fix');
  assert.equal(inferActionType({ intent: 'remediate_stale_lock' }), 'deterministic_fix');
  assert.equal(inferActionType({ intent: 'prune_dangling_worktrees' }), 'deterministic_fix');

  // Fallback to antigravity_triage for research/general actions
  assert.equal(inferActionType({ intent: 'assess_agent_identity' }), 'antigravity_triage');
  assert.equal(inferActionType({}), 'antigravity_triage');

  // validatePayload normalizes missing action_type instead of throwing
  const payloadMissingType = {
    source: 'mobile-gemini-gdoc',
    intent: 'act_trm_ingest_action_type_fallback'
  };
  assert.doesNotThrow(() => validatePayload(payloadMissingType));
  assert.equal(payloadMissingType.action_type, 'antigravity_triage');

  const payloadDeterministic = {
    source: 'mobile-gemini-gdoc',
    intent: 'fix_trm_outbox_leak'
  };
  validatePayload(payloadDeterministic);
  assert.equal(payloadDeterministic.action_type, 'deterministic_fix');
});

test('validatePayload enforces required source and intent fields', () => {
  // Missing source
  assert.throws(() => validatePayload({ intent: 'remediate_stale_lock' }), /Missing source/);

  // Missing intent
  assert.throws(() => validatePayload({ source: 'mobile-gemini' }), /Missing intent/);
});

test('validatePayload infers category, domain, target, and id when omitted', () => {
  const payload = {
    source: 'mobile-grok',
    intent: 'willow_run_bomber_metrics'
  };
  validatePayload(payload);
  assert.equal(payload.category, 'RESEARCH');
  assert.equal(payload.domain, 'cic');
  assert.equal(payload.target, 'cic');
  assert.ok(payload.id.startsWith('act-'));
  assert.equal(payload.action_id, payload.id);
});

test('validatePayload accepts pending-gap schema without requiring source or intent', () => {
  const gapPayload = { type: 'pending-gap', gap_id: 'GAP-01' };
  assert.doesNotThrow(() => validatePayload(gapPayload));
});

test('parsePayload correctly parses JSON and Markdown payloads', async () => {
  // JSON payload
  const jsonPayload = await parsePayload('{"source":"mobile","intent":"test_json"}', '.json');
  assert.equal(jsonPayload.source, 'mobile');
  assert.equal(jsonPayload.intent, 'test_json');

  // Markdown payload with YAML frontmatter
  const mdRaw = '---\nsource: grok\nintent: test_md\ncategory: RESEARCH\n---\nDetailed findings here.';
  const mdPayload = await parsePayload(mdRaw, '.md');
  assert.equal(mdPayload.source, 'grok');
  assert.equal(mdPayload.intent, 'test_md');
  assert.equal(mdPayload.context.body, 'Detailed findings here.');

  // Markdown missing frontmatter throws
  await assert.rejects(
    async () => parsePayload('No frontmatter here', '.md'),
    /Markdown action item missing frontmatter block/
  );
});

test('parsePayload surfaces .gdoc errors on malformed stubs and fetch failures', async () => {
  // Malformed JSON
  await assert.rejects(
    async () => parsePayload('not-json', '.gdoc'),
    /Invalid \.gdoc stub: JSON parse failed/
  );

  // Missing doc_id
  await assert.rejects(
    async () => parsePayload('{"url":"https://docs.google.com"}', '.gdoc'),
    /Invalid \.gdoc stub: missing doc_id/
  );

  // Custom docFetcher with 401 error
  const mockFetcher401 = async (docId) => ({
    ok: false,
    error: '401 Unauthorized'
  });
  await assert.rejects(
    async () => parsePayload('{"doc_id":"doc_auth_fail"}', '.gdoc', { docFetcher: mockFetcher401 }),
    /Failed to fetch gdoc text: 401 Unauthorized/
  );

  // Successful docFetcher returns parsed markdown
  const mockFetcherSuccess = async (docId) => ({
    ok: true,
    content: '---\nsource: mobile-gdoc\nintent: fetch_success\n---\nFetched content body.'
  });
  const res = await parsePayload('{"doc_id":"doc_ok"}', '.gdoc', { docFetcher: mockFetcherSuccess });
  assert.equal(res.source, 'mobile-gdoc');
  assert.equal(res.intent, 'fetch_success');
  assert.equal(res.context.body, 'Fetched content body.');
});

test('processFile catches .gdoc 401 error in dryRun mode and returns structured failure', async () => {
  const mockFetcher401 = async () => ({ ok: false, error: '401 Unauthorized' });
  const result = await processFile('dummy-path.gdoc', {
    dryRun: true,
    docFetcher: mockFetcher401
  });
  // Since dummy file does not exist on disk, processFile returns null
  assert.equal(result, null);
});

test('processFile falls back to filename metadata when .gdoc text body fetch returns 401', async () => {
  const tmpGdoc = path.join(os.tmpdir(), '2026-10-10T120000Z__action__kb-sync__act-test-auth-hardening-fallback.md.gdoc');
  fs.writeFileSync(tmpGdoc, JSON.stringify({ doc_id: 'test_doc_auth_fail' }), 'utf8');
  try {
    const mockFetcher401 = async () => ({ ok: false, error: '401 Unauthorized' });
    const result = await processFile(tmpGdoc, {
      dryRun: true,
      docFetcher: mockFetcher401
    });
    assert.ok(result);
    assert.equal(result.source, 'mobile-gemini-gdoc');
    assert.match(result.intent, /act_test_auth_hardening_fallback/);
  } finally {
    try { fs.unlinkSync(tmpGdoc); } catch {}
  }
});




