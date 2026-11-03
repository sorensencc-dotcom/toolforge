import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import {
  createVerificationItem,
  createHeartbeatReport,
  createStagnationFinding,
  createDayDifferential,
  createGapResolution,
  createReconciliationSummary,
  verifyGroundTruthState,
  assertPipelineHeartbeats,
  detectDayOverDayDifferential,
  resolveDocumentedGaps,
  reconcileDailyReports,
  extractCommitsFromReportText,
  extractBlockersAndGapsFromText
} from '../scripts/reconcile-daily-reports.mjs';

function createTempRepoFixture() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reconcile-test-'));

  // Create directory structure
  fs.mkdirSync(path.join(tmpDir, '.harness', 'tasks', 'pending'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, '.harness', 'tasks', 'completed'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, '.harness', 'tasks', 'archive'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, 'trm-drive', 'inbox', 'quarantine'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, 'trm-drive', 'inbox', 'outbox'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, '_status-feed'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, 'icf', 'dashboard'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, 'docs', 'reports', 'daily'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, 'kb-sync'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, 'wiki', 'research', 'properties'), { recursive: true });

  // Seed daily_status.json
  const initialStatus = {
    generated_at: new Date().toISOString(),
    pipeline_status: 'UNKNOWN',
    sev1_alerts: [],
    todos: {
      total_open: 2,
      top_open: [
        {
          priority: 'P2',
          title: 'Zombie task: act-kbsync-chat-injection-staleness-entropy-fail'
        },
        {
          priority: 'P1',
          title: 'Real open task: live pg migration'
        }
      ]
    },
    trm_intelligence: {
      matrix_gaps_total: 2,
      matrix_gaps_open: 2,
      matrix_gaps_resolved: 0,
      active_gaps: [
        { id: 'GAP-CUBAN-FCSC', target: 'Cuban Seizures FCSC Claims', status: 'OPEN', resolved: false },
        { id: 'GAP-DANISH-DANNEBROG', target: 'Order of the Dannebrog King Christian X', status: 'OPEN', resolved: false }
      ],
      notebook_findings: {
        'c8360946-dbee-4a2c-b622-7f89b05695b0': {
          contradictions: [
            { title: 'FCSC Title V statutory standard Cuban claims', desc: 'FCSC valuation standard', resolved: false }
          ]
        },
        '140119ae-3496-45c9-bf0c-71c955136afc': {
          undersourced: [
            { title: 'Order of the Dannebrog 1930/1937', desc: 'King Christian X appointment', resolved: false }
          ]
        }
      }
    }
  };

  fs.writeFileSync(
    path.join(tmpDir, 'icf', 'dashboard', 'daily_status.json'),
    JSON.stringify(initialStatus, null, 2),
    'utf8'
  );
  fs.writeFileSync(
    path.join(tmpDir, '_status-feed', 'daily_status.json'),
    JSON.stringify(initialStatus, null, 2),
    'utf8'
  );

  // Seed markdown gap files
  const mdGapsContent = `# Mined Research Gaps and Topics

- [/] [GAP-01] **CIC - Cuban Seizures & Retired Assets**: FCSC Title V statutory standards (Drafted: [RFC](wiki/research/cuban.md))
- [/] [GAP-27] **CIC - Post-War & Willys-Overland**: King Christian X appointed Sorensen to the Order of the Dannebrog (Drafted: [RFC](wiki/research/danish.md))
`;
  fs.writeFileSync(path.join(tmpDir, 'trm-research-gaps.md'), mdGapsContent, 'utf8');
  fs.writeFileSync(path.join(tmpDir, 'kb-sync', 'trm-research-gaps.md'), mdGapsContent, 'utf8');

  // Seed citation research files
  fs.writeFileSync(
    path.join(tmpDir, 'wiki', 'research', 'cuban-seizures-and-retired-assets-overview.md'),
    '# Cuban Seizures Overview\nDocumented Title V statutory standards and FCSC awards.',
    'utf8'
  );
  fs.writeFileSync(
    path.join(tmpDir, 'wiki', 'research', 'rfc-gap-07-the-danish-pipeline-transatlantic-telemetry.md'),
    '# Danish Pipeline\nOrder of the Dannebrog protocols 1930 & 1937 under King Christian X.',
    'utf8'
  );

  return tmpDir;
}

function cleanupTempRepoFixture(tmpDir) {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {}
}

// ============================================================================
// DOMAIN SHAPE TESTS
// ============================================================================

test('Domain model factories construct conforming shapes', () => {
  const item = createVerificationItem({
    id: 'act-test-item',
    type: 'card',
    source: 'quarantine',
    status: 'CLOSED',
    verifiedBy: 'git',
    zombie: true,
    actionTaken: 'archived_from_quarantine'
  });
  assert.equal(item.id, 'act-test-item');
  assert.equal(item.type, 'card');
  assert.equal(item.status, 'CLOSED');
  assert.equal(item.verifiedBy, 'git');
  assert.equal(item.zombie, true);
  assert.equal(item.actionTaken, 'archived_from_quarantine');

  const hb = createHeartbeatReport({
    daemon: 'notebook_ingester',
    logPath: '_status-feed/notebook_ingester_report.json',
    lastModified: new Date('2026-11-01T00:00:00Z'),
    ageHours: 26.5,
    thresholdHours: 24,
    status: 'PIPELINE_STALL',
    sev1Alert: true,
    message: '[SEV-1 PIPELINE_STALL] Daemon notebook_ingester flatlined'
  });
  assert.equal(hb.daemon, 'notebook_ingester');
  assert.equal(hb.status, 'PIPELINE_STALL');
  assert.equal(hb.sev1Alert, true);
  assert.equal(hb.ageHours, 26.5);

  const stag = createStagnationFinding({
    text: 'repo_root check',
    firstSeenDate: '2026-10-30',
    daysActive: 3,
    loopDetected: true,
    message: 'Stagnant query'
  });
  assert.equal(stag.daysActive, 3);
  assert.equal(stag.loopDetected, true);

  const diff = createDayDifferential({
    todayDate: '2026-11-01',
    yesterdayDate: '2026-10-31',
    landedCommits: ['abc1234: fix something'],
    closedGaps: ['GAP-01'],
    newBlockers: ['Blocker X'],
    stagnantFindings: [stag]
  });
  assert.equal(diff.landedCommits.length, 1);
  assert.equal(diff.closedGaps.length, 1);
  assert.equal(diff.newBlockers.length, 1);
  assert.equal(diff.stagnantFindings.length, 1);

  const res = createGapResolution({
    gapId: 'GAP-CUBAN-FCSC',
    title: 'FCSC Cuban claim rolls',
    citationSource: 'wiki/research/cuban.md',
    resolved: true,
    receiptEmitted: true,
    outboxPaths: ['/tmp/receipt.json']
  });
  assert.equal(res.gapId, 'GAP-CUBAN-FCSC');
  assert.equal(res.resolved, true);

  const summary = createReconciliationSummary({
    verifications: [item],
    heartbeats: [hb],
    sev1Banners: [hb.message],
    differential: diff,
    gapResolutions: [res],
    cleanupsCount: 2
  });
  assert.equal(summary.verifications.length, 1);
  assert.equal(summary.heartbeats.length, 1);
  assert.equal(summary.sev1Banners.length, 1);
  assert.equal(summary.cleanupsCount, 2);
});

// ============================================================================
// PHASE 1: GROUND-TRUTH STATE VERIFICATION (ZOMBIE PURGE)
// ============================================================================

test('verifyGroundTruthState cleanses zombie cards and updates daily_status', async () => {
  const tmpDir = createTempRepoFixture();
  try {
    // Seed quarantine zombie file
    const zombieQuarantine = path.join(
      tmpDir,
      'trm-drive',
      'inbox',
      'quarantine',
      '2026-11-01T171300Z__action__kb-sync__act-kbsync-chat-injection-staleness-entropy-fail.md.gdoc'
    );
    fs.writeFileSync(zombieQuarantine, '{"title":"zombie"}', 'utf8');

    // Seed pending task zombie file
    const zombiePending = path.join(
      tmpDir,
      '.harness',
      'tasks',
      'pending',
      '2026-11-01T171300Z__action__kb-sync__act-kbsync-chat-injection-staleness-entropy-fail.md'
    );
    fs.writeFileSync(zombiePending, '{"title":"zombie pending"}', 'utf8');

    const verifications = await verifyGroundTruthState({
      repoRoot: tmpDir,
      dryRun: false
    });

    // Check verification results
    const zombieResults = verifications.filter(v => v.zombie);
    assert.ok(zombieResults.length >= 1, 'Should detect at least 1 zombie');
    assert.equal(zombieResults[0].status, 'CLOSED');
    assert.equal(zombieResults[0].zombie, true);

    // Verify quarantine card moved to archive
    assert.equal(fs.existsSync(zombieQuarantine), false, 'Quarantined zombie card should be moved');
    const archivedCard = path.join(
      tmpDir,
      'trm-drive',
      'inbox',
      'archive',
      path.basename(zombieQuarantine)
    );
    assert.equal(fs.existsSync(archivedCard), true, 'Zombie card should exist in archive');

    // Verify pending task moved to completed
    assert.equal(fs.existsSync(zombiePending), false, 'Pending zombie card should be moved');
    const completedTask = path.join(
      tmpDir,
      '.harness',
      'tasks',
      'completed',
      path.basename(zombiePending)
    );
    assert.equal(fs.existsSync(completedTask), true, 'Zombie card should exist in completed');

    // Verify daily_status.json purged zombie todo
    const statusData = JSON.parse(
      fs.readFileSync(path.join(tmpDir, 'icf', 'dashboard', 'daily_status.json'), 'utf8')
    );
    const hasZombieTodo = statusData.todos.top_open.some(t =>
      t.title.includes('act-kbsync-chat-injection-staleness-entropy-fail')
    );
    assert.equal(hasZombieTodo, false, 'daily_status top_open should no longer contain zombie todo');
    assert.equal(statusData.todos.total_open, 1, 'total_open should decrement');
  } finally {
    cleanupTempRepoFixture(tmpDir);
  }
});

// ============================================================================
// PHASE 2: PIPELINE HEARTBEATS & SEV-1 ALERTS
// ============================================================================

test('assertPipelineHeartbeats flags stalled and missing daemons with SEV-1 alerts', async () => {
  const tmpDir = createTempRepoFixture();
  try {
    const fixedNow = new Date('2026-11-01T12:00:00Z');

    // Seed healthy daemon report (2 hours old)
    const healthyTime = new Date('2026-11-01T10:00:00Z').toISOString();
    fs.writeFileSync(
      path.join(tmpDir, '_status-feed', 'kb_sentinel_report.json'),
      JSON.stringify({ timestamp: healthyTime, status: 'ok' }),
      'utf8'
    );

    // Seed stalled daemon report (36 hours old)
    const stalledTime = new Date('2026-10-31T00:00:00Z').toISOString();
    fs.writeFileSync(
      path.join(tmpDir, '_status-feed', 'notebook_ingester_report.json'),
      JSON.stringify({ timestamp: stalledTime, status: 'stalled' }),
      'utf8'
    );

    // Run assertion with 24h threshold
    const { heartbeats, sev1Banners, pipelineStatus } = await assertPipelineHeartbeats({
      repoRoot: tmpDir,
      maxStallHours: 24,
      now: fixedNow,
      dryRun: false
    });

    assert.equal(pipelineStatus, 'STALLED');
    assert.ok(sev1Banners.length >= 1, 'Should emit at least 1 SEV-1 banner');

    const healthyHb = heartbeats.find(h => h.daemon === 'kb_sentinel');
    assert.ok(healthyHb);
    assert.equal(healthyHb.status, 'HEALTHY');
    assert.equal(healthyHb.sev1Alert, false);

    const stalledHb = heartbeats.find(h => h.daemon === 'notebook_ingester');
    assert.ok(stalledHb);
    assert.equal(stalledHb.status, 'PIPELINE_STALL');
    assert.equal(stalledHb.sev1Alert, true);
    assert.ok(stalledHb.message.includes('[SEV-1 PIPELINE_STALL]'));

    // Check that daily_status was updated with SEV-1 banner and pipeline status
    const statusData = JSON.parse(
      fs.readFileSync(path.join(tmpDir, 'icf', 'dashboard', 'daily_status.json'), 'utf8')
    );
    assert.equal(statusData.pipeline_status, 'STALLED');
    assert.ok(statusData.sev1_alerts.length >= 1);
  } finally {
    cleanupTempRepoFixture(tmpDir);
  }
});

// ============================================================================
// PHASE 3: DAY-OVER-DAY DIFFERENTIAL & STAGNANT LOOP DETECTION
// ============================================================================

test('detectDayOverDayDifferential calculates commit deltas, blockers, and stagnant findings', async () => {
  const tmpDir = createTempRepoFixture();
  try {
    const reportDir = path.join(tmpDir, 'docs', 'reports', 'daily');

    // Report for yesterday
    const yestContent = `# Daily Report: 2026-10-31

### Commits
  - 1111111: commit one
  - 2222222: commit two

## Blockers
- SLA exceeded: Danish Rigsarkivet Sydhavnen Inquiry
- Old resolved blocker

## Gaps
- [GAP-01] Old Cuban gap
- [GAP-02] Shared gap
`;
    fs.writeFileSync(path.join(reportDir, '2026-10-31.md'), yestContent, 'utf8');

    // Report for today
    const todayContent = `# Daily Report: 2026-11-01

### Commits
  - 2222222: commit two
  - 3333333: commit three newly landed

## Blockers
- SLA exceeded: Danish Rigsarkivet Sydhavnen Inquiry
- New blocker on auth

## Gaps
- [GAP-02] Shared gap
`;
    fs.writeFileSync(path.join(reportDir, '2026-11-01.md'), todayContent, 'utf8');

    const diff = await detectDayOverDayDifferential({
      repoRoot: tmpDir,
      reportDir,
      todayDate: '2026-11-01',
      yesterdayDate: '2026-10-31'
    });

    assert.equal(diff.todayDate, '2026-11-01');
    assert.equal(diff.yesterdayDate, '2026-10-31');

    // Landed commits: 3333333 should be present, not 1111111 or 2222222
    assert.equal(diff.landedCommits.length, 1);
    assert.ok(diff.landedCommits[0].includes('3333333'));

    // Closed gaps: GAP-01 should be closed
    assert.equal(diff.closedGaps.length, 1);
    assert.ok(diff.closedGaps[0].includes('GAP-01'));

    // New blockers: New blocker on auth should be detected
    assert.equal(diff.newBlockers.length, 1);
    assert.ok(diff.newBlockers[0].includes('New blocker on auth'));

    // Stagnant loop detection: 'SLA exceeded: Danish Rigsarkivet Sydhavnen Inquiry' repeated across both days
    assert.ok(diff.stagnantFindings.length >= 1, 'Should detect stagnant loop for repeated blocker');
    const loop = diff.stagnantFindings.find(f => f.text.includes('Danish Rigsarkivet'));
    assert.ok(loop);
    assert.equal(loop.loopDetected, true);
    assert.ok(loop.daysActive >= 2);
  } finally {
    cleanupTempRepoFixture(tmpDir);
  }
});

// ============================================================================
// PHASE 4: AUTOMATED GAP RESOLUTION & RECEIPT EMISSION
// ============================================================================

test('resolveDocumentedGaps reconciles documented gaps and emits receipts to outbox', async () => {
  const tmpDir = createTempRepoFixture();
  try {
    const outboxDir = path.join(tmpDir, 'trm-drive', 'inbox', 'outbox');

    const resolutions = await resolveDocumentedGaps({
      repoRoot: tmpDir,
      dryRun: false
    });

    assert.equal(resolutions.length, 2, 'Should process both documented gap configs');
    for (const r of resolutions) {
      assert.equal(r.resolved, true, `Gap ${r.gapId} should be resolved`);
      assert.equal(r.receiptEmitted, true);
      assert.ok(r.outboxPaths.length >= 2, 'Should emit JSON and MD receipts');
    }

    // Verify outbox receipt files exist
    const cubanJsonReceipt = path.join(outboxDir, 'receipt-act-cuban-fcsc-claims-resolution-completed.json');
    const cubanMdReceipt = path.join(outboxDir, 'receipt-act-cuban-fcsc-claims-resolution-completed.md');
    const danishJsonReceipt = path.join(outboxDir, 'receipt-act-danish-royal-honors-resolution-completed.json');
    const danishMdReceipt = path.join(outboxDir, 'receipt-act-danish-royal-honors-resolution-completed.md');

    assert.equal(fs.existsSync(cubanJsonReceipt), true);
    assert.equal(fs.existsSync(cubanMdReceipt), true);
    assert.equal(fs.existsSync(danishJsonReceipt), true);
    assert.equal(fs.existsSync(danishMdReceipt), true);

    const jsonReceiptData = JSON.parse(fs.readFileSync(cubanJsonReceipt, 'utf8'));
    assert.equal(jsonReceiptData.status, 'COMPLETED');
    assert.equal(jsonReceiptData.resolved, true);

    // Verify markdown checkboxes updated to - [x]
    const mdContent = fs.readFileSync(path.join(tmpDir, 'trm-research-gaps.md'), 'utf8');
    assert.ok(mdContent.includes('- [x] [GAP-01] **CIC - Cuban Seizures & Retired Assets**'));
    assert.ok(mdContent.includes('- [x] [GAP-27] **CIC - Post-War & Willys-Overland**'));

    // Verify daily_status notebook findings marked resolved
    const statusData = JSON.parse(
      fs.readFileSync(path.join(tmpDir, 'icf', 'dashboard', 'daily_status.json'), 'utf8')
    );
    const cubanFinding = statusData.trm_intelligence.notebook_findings['c8360946-dbee-4a2c-b622-7f89b05695b0'];
    assert.equal(cubanFinding.contradictions[0].resolved, true);
    assert.equal(cubanFinding.contradictions[0].status, 'RESOLVED');

    const danishFinding = statusData.trm_intelligence.notebook_findings['140119ae-3496-45c9-bf0c-71c955136afc'];
    assert.equal(danishFinding.undersourced[0].resolved, true);
    assert.equal(danishFinding.undersourced[0].status, 'RESOLVED');
  } finally {
    cleanupTempRepoFixture(tmpDir);
  }
});

// ============================================================================
// DRY-RUN IDEMPOTENCY & FULL RECONCILIATION SUMMARY
// ============================================================================

test('reconcileDailyReports dry-run leaves disk unchanged and returns complete summary', async () => {
  const tmpDir = createTempRepoFixture();
  try {
    const outboxDir = path.join(tmpDir, 'trm-drive', 'inbox', 'outbox');

    // Seed quarantine zombie file
    const zombieQuarantine = path.join(
      tmpDir,
      'trm-drive',
      'inbox',
      'quarantine',
      '2026-11-01T171300Z__action__kb-sync__act-kbsync-chat-injection-staleness-entropy-fail.md.gdoc'
    );
    fs.writeFileSync(zombieQuarantine, '{"title":"zombie"}', 'utf8');

    // Run reconciliation with dryRun: true
    const summary = await reconcileDailyReports({
      repoRoot: tmpDir,
      dryRun: true,
      silent: true
    });

    assert.equal(summary.dryRun, true);
    assert.ok(summary.cleanupsCount >= 1, 'Should report potential cleanups');
    assert.ok(Array.isArray(summary.verifications));
    assert.ok(Array.isArray(summary.heartbeats));
    assert.ok(summary.differential !== null);
    assert.ok(Array.isArray(summary.gapResolutions));

    // Verify quarantine card was NOT moved in dry-run
    assert.equal(fs.existsSync(zombieQuarantine), true, 'File should remain in quarantine during dry-run');

    // Verify no receipts were emitted to outbox
    const receiptFiles = fs.readdirSync(outboxDir);
    assert.equal(receiptFiles.length, 0, 'No receipts should be written to outbox during dry-run');

    // Verify markdown was NOT modified in dry-run
    const mdContent = fs.readFileSync(path.join(tmpDir, 'trm-research-gaps.md'), 'utf8');
    assert.ok(mdContent.includes('- [/] [GAP-01]'), 'Markdown gap should remain unmodified during dry-run');
  } finally {
    cleanupTempRepoFixture(tmpDir);
  }
});
