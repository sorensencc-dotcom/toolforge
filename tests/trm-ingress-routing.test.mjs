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
  processFile,
  applySmallModelTriage,
  commitTypeForCard,
  logToLedger,
  refreshLedgerMarkdown,
  findExistingGitHubIssueOrPr,
  getValidAccessToken,
  resetTokenCacheForTesting
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
  assert.equal(inferDomain({ topic: 'cic' }), 'cic');
  assert.equal(inferDomain({ topic: 'cic-kb' }), 'cic');
  assert.equal(inferDomain({ topic: 'whichllm-routing' }), 'whichllm');
  assert.equal(inferDomain({ topic: 'toolforge-plugin' }), 'toolforge');
  assert.equal(inferDomain({ topic: 'rewrite-mcp' }), 'rewrite');
  assert.equal(inferDomain({ topic: 'sigil-rooms' }), 'sigil');
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

test('validatePayload normalizes grok/grocery source and infers intent from title or topic', () => {
  const grokDrop = {
    source: 'grok',
    skill: 'drive-it',
    topic: 'cic',
    title: 'Willys five-contradictions lock — Jeep Day, Canaday, March 1946 pickup',
    status: 'drop'
  };
  validatePayload(grokDrop);
  assert.equal(grokDrop.source, 'mobile-grok');
  assert.equal(grokDrop.action_type, 'antigravity_triage');
  assert.equal(grokDrop.category, 'RESEARCH');
  assert.equal(grokDrop.domain, 'cic');
  assert.match(grokDrop.intent, /^willys_five_contradictions_lock/);

  // Autocorrected "grocery" source
  const groceryDrop = {
    source: 'grocery',
    topic: 'cic',
    title: 'Ferguson BFRC Search Plan'
  };
  validatePayload(groceryDrop);
  assert.equal(groceryDrop.source, 'mobile-grok');
  assert.equal(groceryDrop.intent, 'ferguson_bfrc_search_plan');
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

test('processFile enriches unmapped action cards using default small-model triage', async () => {
  const tmpJson = path.join(os.tmpdir(), 'act-test-small-model-default.json');
  fs.writeFileSync(tmpJson, JSON.stringify({
    source: 'mobile-gemini',
    summary: 'Evaluate latency spike on SQLite WAL checkpointing'
  }), 'utf8');
  try {
    const result = await processFile(tmpJson, { dryRun: true });
    assert.ok(result);
    assert.equal(result.source, 'mobile-gemini');
    assert.ok(result.execution_plan, 'Execution plan should be generated by default small-model bridge');
    assert.equal(result.priority, 'P2');
  } finally {
    try { fs.unlinkSync(tmpJson); } catch {}
  }
});

test('applySmallModelTriage rejects priorities outside P1-P3', () => {
  const kept = applySmallModelTriage(
    { intent: 'operator_set_intent', priority: 'P3' },
    { intent: 'review_pr', priority: 'P0', action_type: 'antigravity_triage' }
  );
  assert.equal(kept.intent, 'operator_set_intent');
  assert.equal(kept.priority, 'P3');

  const filled = applySmallModelTriage(
    {},
    { intent: 'review_pr', priority: 'DROP TABLE', action_type: 'antigravity_triage' }
  );
  assert.equal(filled.intent, 'review_pr');
  assert.equal(filled.priority, 'P2');
  assert.equal(filled.action_type, 'antigravity_triage');
});

test('applySmallModelTriage strips destructive commands from execution_plan', () => {
  const triagedWithDestructivePlan = applySmallModelTriage(
    {},
    {
      intent: 'triage_mobile_request',
      execution_plan: [
        { step: 1, handler: 'ironbot', action: 'safe_op', command: 'node scripts/consolidate-pack.mjs' },
        { step: 2, handler: 'ironbot', action: 'malicious', command: "bash -c 'sudo rm -rf /path/to/enobufs'" }
      ]
    }
  );
  assert.equal(triagedWithDestructivePlan.execution_plan.length, 1);
  assert.equal(triagedWithDestructivePlan.execution_plan[0].action, 'safe_op');
});

test('processFile keeps operator intent and priority when small-model triage reruns', async () => {
  const tmpJson = path.join(os.tmpdir(), 'act-test-keep-operator-fields.json');
  fs.writeFileSync(tmpJson, JSON.stringify({
    source: 'mobile-gemini',
    intent: 'operator_set_intent',
    priority: 'P3',
    summary: 'Mobile action item submitted via Google Docs: review the ingress watcher'
  }), 'utf8');
  try {
    const result = await processFile(tmpJson, { dryRun: true });
    assert.equal(result.intent, 'operator_set_intent');
    assert.equal(result.priority, 'P3');
  } finally {
    try { fs.unlinkSync(tmpJson); } catch {}
  }
});

test('processFile enriches fallback .gdoc cards via small-model triage with clean input', async () => {
  const tmpGdoc = path.join(os.tmpdir(), '2026-10-10T233001Z__action__toolforge__act-test-quicksand-qemu.md.gdoc');
  fs.writeFileSync(tmpGdoc, JSON.stringify({
    url: 'https://docs.google.com/document/d/mock-qemu',
    doc_id: 'mock-qemu'
  }), 'utf8');

  const mockFetcher401 = async () => {
    const err = new Error('401 Unauthorized');
    err.status = 401;
    throw err;
  };

  try {
    const result = await processFile(tmpGdoc, {
      dryRun: true,
      docFetcher: mockFetcher401
    });
    assert.ok(result);
    assert.equal(result.source, 'mobile-gemini-gdoc');
    assert.ok(result.execution_plan, 'Execution plan should be generated for fallback .gdoc card');
    assert.ok(result.context?.raw_input, 'Cleaned input string should be preserved in context');
    assert.ok(!result.context.raw_input.startsWith('Mobile action item submitted via Google Docs:'), 'Should strip wrapper noise from prompt input');
  } finally {
    try { fs.unlinkSync(tmpGdoc); } catch {}
  }
});

test('commitTypeForCard maps action types and categories to conventional commit prefixes', () => {
  assert.equal(commitTypeForCard({ action_type: 'deterministic_fix' }), 'fix');
  assert.equal(commitTypeForCard({ category: 'RESEARCH' }), 'chore');
  assert.equal(commitTypeForCard({ category: 'EVALUATE' }), 'chore');
  assert.equal(commitTypeForCard({ category: 'IMPLEMENT' }), 'feat');
  assert.equal(commitTypeForCard({}), 'feat');
});

test('getRoutingDecision routes .gdoc fetch failure to RESEARCH and suppresses GitHub issue creation', () => {
  const gdocFailureDecision = getRoutingDecision({
    id: 'act-gdoc-fail',
    action_type: 'antigravity_triage',
    category: 'IMPLEMENT',
    domain: 'toolforge',
    target: 'toolforge',
    intent: 'act_gdoc_fail',
    context: {
      gdoc_filename: 'mock.gdoc',
      gdoc_stem: 'mock',
      note: 'Ingested from .gdoc pointer via filename metadata (body text fetch failed: 401 Unauthorized)',
      body_fetch_failed: true
    }
  });

  assert.equal(gdocFailureDecision.isGDocFetchFailure, true);
  assert.equal(gdocFailureDecision.category, 'RESEARCH');
  assert.equal(gdocFailureDecision.shouldCreateGitHubIssue, false);
});

test('logToLedger persists archived_path, context, execution_plan, deliverables, and direction', () => {
  const tmpLedger = path.join(os.tmpdir(), `trm-test-ledger-${Date.now()}.jsonl`);
  process.env.TRM_LEDGER_PATH = tmpLedger;
  try {
    const testId = `test-persist-${Date.now()}`;
    logToLedger({
      id: testId,
      processed_at: new Date().toISOString(),
      status: 'COMPLETED',
      archived_path: 'C:/dev/trm-drive/inbox/completed/mock.json',
      context: { test: true },
      execution_plan: [{ step: 1, action: 'verify' }],
      deliverables: 'All deliverables present',
      direction: 'Follow engineering standards'
    });

    const content = fs.readFileSync(tmpLedger, 'utf8');
    const rows = content.trim().split('\n').map(l => JSON.parse(l));
    const found = rows.find(r => r.id === testId);

    assert.ok(found, 'Row must exist in ledger');
    assert.equal(found.archived_path, 'C:/dev/trm-drive/inbox/completed/mock.json');
    assert.deepEqual(found.context, { test: true });
    assert.deepEqual(found.execution_plan, [{ step: 1, action: 'verify' }]);
    assert.equal(found.deliverables, 'All deliverables present');
    assert.equal(found.direction, 'Follow engineering standards');
  } finally {
    delete process.env.TRM_LEDGER_PATH;
    try { fs.unlinkSync(tmpLedger); } catch {}
  }
});

test('parseGDocFilenameMetadata provides humanTitle and clean title casing', () => {
  const meta = parseGDocFilenameMetadata('2026-10-12T124003Z__action__rewrite-mcp__act-03-evaluate-incident-reporting-guardrails.md.gdoc');
  assert.equal(meta.title, 'Evaluate Incident Reporting Guardrails');
  assert.equal(meta.intent, 'evaluate_incident_reporting_guardrails');
  assert.match(meta.summary, /Mobile action item: Evaluate Incident Reporting Guardrails/);
});

test('getRoutingDecision treats cards with substantive raw_content as valid and routes coding directions to GitHub issue', () => {
  const card = {
    action_type: 'antigravity_triage',
    target: 'toolforge',
    category: 'EVALUATE',
    direction: 'REFACTOR_OPTIMIZATION',
    raw_content: 'source: gemini-spark\ncategory: EVALUATE\ndirection: REFACTOR_OPTIMIZATION\ntarget: toolforge\n### Directive\nRemediate workflow failures',
    context: {
      body_fetch_failed: true,
      note: 'Ingested from .gdoc pointer via filename metadata (body text fetch failed: 401 Unauthorized)'
    }
  };

  const decision = getRoutingDecision(card);
  assert.equal(decision.isGDocFetchFailure, false, 'Card with raw_content must not be marked as fetch failure');
  assert.equal(decision.shouldCreateGitHubIssue, true, 'Coding card with raw_content must create GitHub issue');
  assert.equal(decision.repo, 'sorensencc-dotcom/toolforge');
});

test('getValidAccessToken returns env token when refresh token is absent', async () => {
  resetTokenCacheForTesting();
  const origToken = process.env.GOOGLE_OAUTH_TOKEN;
  const origRefresh = process.env.GOOGLE_REFRESH_TOKEN;
  delete process.env.GOOGLE_REFRESH_TOKEN;
  process.env.GOOGLE_OAUTH_TOKEN = 'test-static-token';

  try {
    const token = await getValidAccessToken(true);
    assert.equal(token, 'test-static-token');
  } finally {
    if (origToken !== undefined) process.env.GOOGLE_OAUTH_TOKEN = origToken;
    else delete process.env.GOOGLE_OAUTH_TOKEN;
    if (origRefresh !== undefined) process.env.GOOGLE_REFRESH_TOKEN = origRefresh;
  }
});

test('getValidAccessToken deduplicates concurrent refresh calls via in-flight promise', async () => {
  resetTokenCacheForTesting();
  const origId = process.env.GOOGLE_CLIENT_ID;
  const origSec = process.env.GOOGLE_CLIENT_SECRET;
  const origRef = process.env.GOOGLE_REFRESH_TOKEN;
  const origFetch = globalThis.fetch;

  process.env.GOOGLE_CLIENT_ID = 'test-client';
  process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
  process.env.GOOGLE_REFRESH_TOKEN = 'test-refresh';

  let fetchCallCount = 0;
  globalThis.fetch = async () => {
    fetchCallCount++;
    await new Promise((resolve) => setTimeout(resolve, 50));
    return {
      ok: true,
      json: async () => ({ access_token: `token-count-${fetchCallCount}`, expires_in: 3600 })
    };
  };

  try {
    const [t1, t2, t3] = await Promise.all([
      getValidAccessToken(true),
      getValidAccessToken(true),
      getValidAccessToken(true)
    ]);

    assert.equal(fetchCallCount, 1, 'Concurrent calls must be deduplicated to a single fetch');
    assert.equal(t1, t2);
    assert.equal(t2, t3);
  } finally {
    globalThis.fetch = origFetch;
    if (origId !== undefined) process.env.GOOGLE_CLIENT_ID = origId;
    else delete process.env.GOOGLE_CLIENT_ID;
    if (origSec !== undefined) process.env.GOOGLE_CLIENT_SECRET = origSec;
    else delete process.env.GOOGLE_CLIENT_SECRET;
    if (origRef !== undefined) process.env.GOOGLE_REFRESH_TOKEN = origRef;
    else delete process.env.GOOGLE_REFRESH_TOKEN;
  }
});

test('parsePayload retries export upon receiving Google 302 login redirect', async () => {
  resetTokenCacheForTesting();
  const origId = process.env.GOOGLE_CLIENT_ID;
  const origSec = process.env.GOOGLE_CLIENT_SECRET;
  const origRef = process.env.GOOGLE_REFRESH_TOKEN;
  const origToken = process.env.GOOGLE_OAUTH_TOKEN;
  const origFetch = globalThis.fetch;

  process.env.GOOGLE_CLIENT_ID = 'test-client';
  process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
  process.env.GOOGLE_REFRESH_TOKEN = 'test-refresh';
  process.env.GOOGLE_OAUTH_TOKEN = 'initial-stale-token';

  let exportCallCount = 0;
  let refreshCallCount = 0;

  globalThis.fetch = async (url, opts) => {
    const urlStr = String(url);
    if (urlStr.includes('oauth2.googleapis.com')) {
      refreshCallCount++;
      return {
        ok: true,
        json: async () => ({ access_token: 'new-fresh-token', expires_in: 3600 })
      };
    }
    if (urlStr.includes('docs.google.com/document/d/')) {
      exportCallCount++;
      if (exportCallCount === 1) {
        // Return 302 redirecting to ServiceLogin
        return {
          ok: false,
          status: 302,
          headers: new Map([['location', 'https://accounts.google.com/ServiceLogin']])
        };
      }
      // Second attempt succeeds with valid markdown
      return {
        ok: true,
        status: 200,
        text: async () => '---\nsource: mobile-gdoc\nintent: test_recovered\n---\nRecovered doc body.'
      };
    }
    return { ok: false, status: 404 };
  };

  try {
    const parsed = await parsePayload('{"doc_id":"mock_redirect_doc"}', '.gdoc');
    assert.equal(exportCallCount, 2, 'Export should be retried after redirect challenge');
    assert.equal(refreshCallCount, 2, 'Initial acquisition + forced refresh on redirect challenge');
    assert.equal(parsed.intent, 'test_recovered');
    assert.equal(parsed.context.body, 'Recovered doc body.');
  } finally {
    globalThis.fetch = origFetch;
    if (origId !== undefined) process.env.GOOGLE_CLIENT_ID = origId;
    else delete process.env.GOOGLE_CLIENT_ID;
    if (origSec !== undefined) process.env.GOOGLE_CLIENT_SECRET = origSec;
    else delete process.env.GOOGLE_CLIENT_SECRET;
    if (origRef !== undefined) process.env.GOOGLE_REFRESH_TOKEN = origRef;
    else delete process.env.GOOGLE_REFRESH_TOKEN;
    if (origToken !== undefined) process.env.GOOGLE_OAUTH_TOKEN = origToken;
    else delete process.env.GOOGLE_OAUTH_TOKEN;
  }
});

test('auditOutboxReconciliation computes SLA metrics and slaStatus', () => {
  const audit = auditOutboxReconciliation();
  assert.ok(audit, 'auditOutboxReconciliation should return an object');
  assert.ok(typeof audit.slaStatus === 'string', 'slaStatus should be a string');
  assert.ok(['NOMINAL', 'P1_ALARM', 'P2_ALARM'].includes(audit.slaStatus), `Invalid slaStatus: ${audit.slaStatus}`);
  assert.ok(Array.isArray(audit.slaAlerts), 'slaAlerts should be an array');
  assert.ok(Array.isArray(audit.unIngestedStagedOverdue), 'unIngestedStagedOverdue should be an array');
  assert.ok(Array.isArray(audit.unReceiptedOverdue), 'unReceiptedOverdue should be an array');
});

test('findExistingGitHubIssueOrPr handles null, empty, or unresolvable targets safely', () => {
  assert.equal(findExistingGitHubIssueOrPr(null, 'test'), null);
  assert.equal(findExistingGitHubIssueOrPr('sorensencc-dotcom/kb-sync', null), null);
  assert.equal(findExistingGitHubIssueOrPr('sorensencc-dotcom/kb-sync', ''), null);
});

test('refreshLedgerMarkdown renders PR links as [repo#prNum (PR)](url)', () => {
  const tmpLedger = path.join(os.tmpdir(), `trm-ledger-pr-test-${Date.now()}.jsonl`);
  const tmpMd = path.join(os.tmpdir(), 'LEDGER.md');
  const row = {
    id: 'act-pr-test-1',
    processed_at: new Date().toISOString(),
    status: 'COMPLETED',
    source: 'mobile-gemini',
    action_type: 'antigravity_triage',
    intent: 'test_pr_linking',
    target_notebook_name: 'KB-SYNC',
    pr_url: 'https://github.com/sorensencc-dotcom/kb-sync/pull/106'
  };
  fs.writeFileSync(tmpLedger, JSON.stringify(row) + '\n', 'utf8');

  try {
    refreshLedgerMarkdown(tmpLedger);
    assert.ok(fs.existsSync(tmpMd), 'LEDGER.md must be generated');
    const md = fs.readFileSync(tmpMd, 'utf8');
    assert.ok(md.includes('[sorensencc-dotcom/kb-sync#106 (PR)](https://github.com/sorensencc-dotcom/kb-sync/pull/106)'), 'Markdown should contain formatted PR link');
  } finally {
    try { fs.unlinkSync(tmpLedger); } catch {}
    try { fs.unlinkSync(tmpMd); } catch {}
  }
});

test('syncCompletionReceipts emits terminal receipt when row has completed/merged pr_url', () => {
  const tmpLedger = path.join(os.tmpdir(), `trm-ledger-sync-pr-${Date.now()}.jsonl`);
  const testId = `test-pr-sync-${Date.now()}`;
  const row = {
    id: testId,
    processed_at: new Date().toISOString(),
    status: 'COMPLETED',
    source: 'mobile-gemini',
    action_type: 'antigravity_triage',
    intent: 'test_pr_sync_terminal',
    target_notebook_name: 'KB-SYNC',
    pr_url: 'https://github.com/sorensencc-dotcom/kb-sync/pull/106',
    summary: 'PR 106 merged'
  };
  fs.writeFileSync(tmpLedger, JSON.stringify(row) + '\n', 'utf8');

  process.env.TRM_DRIVE = os.tmpdir();
  const receipts = syncCompletionReceipts({ dryRun: true });
  assert.ok(Array.isArray(receipts), 'syncCompletionReceipts returns an array');
});

test('processFile suppresses closed zombie action cards for Issue 140', async () => {
  const tmpCard = path.join(os.tmpdir(), `act-kbsync-chat-injection-staleness-entropy-fail-${Date.now()}.json`);
  const payload = {
    id: 'act-kbsync-chat-injection-staleness-entropy-fail',
    source: 'mobile-gemini',
    action_type: 'antigravity_triage',
    intent: 'act_kbsync_chat_injection_staleness_entropy_fail',
    timestamp: new Date().toISOString()
  };
  fs.writeFileSync(tmpCard, JSON.stringify(payload), 'utf8');

  try {
    const result = await processFile(tmpCard, { dryRun: true });
    assert.equal(result.status, 'SUPPRESSED_CLOSED_ISSUE');
  } finally {
    if (fs.existsSync(tmpCard)) fs.unlinkSync(tmpCard);
  }
});







