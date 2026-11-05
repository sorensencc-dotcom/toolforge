import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  deriveCleanTitle,
  expandQuarantinedCard,
  healCardFile,
  runQuarantineAutoHealer
} from '../scripts/heal-quarantined-cards.mjs';

function createTempDir(name) {
  const dir = path.join(os.tmpdir(), `heal-cards-test-${name}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

test('deriveCleanTitle: correctly parses stems, raw inputs, and explicit titles', () => {
  assert.equal(deriveCleanTitle({ title: 'Standard Feature Task' }), 'Standard Feature Task');
  assert.equal(deriveCleanTitle({ context: { real_title: 'Real Ingested Title' } }), 'Real Ingested Title');
  assert.equal(deriveCleanTitle({ context: { raw_input: 'act kbsync conflict log entry 11 death date' } }), 'Act Kbsync Conflict Log Entry 11 Death Date');
  assert.equal(
    deriveCleanTitle({ context: { gdoc_stem: '2026-11-04T142501Z__action__sigil__act-01-claude-stateful-message-threads' } }),
    '01 Claude Stateful Message Threads'
  );
});

test('expandQuarantinedCard: generates substantive content (>50 chars) and resets failure flags', () => {
  const briefCard = {
    id: 'act-test-card',
    timestamp: '2026-11-05T00:00:00Z',
    target: 'sigil',
    category: 'RESEARCH',
    title: 'Brief Card',
    summary: 'Mobile action item: Brief Card',
    context: {
      body_fetch_failed: true,
      note: 'Ingested from .gdoc pointer (body text fetch failed: 401 Unauthorized)'
    }
  };

  const healed = expandQuarantinedCard(briefCard, 'test.md.gdoc');

  assert.equal(healed.context.body_fetch_failed, false);
  assert.equal(healed.context.healed, true);
  assert.ok(healed.summary.length > 50, 'summary must be >50 characters');
  assert.ok(healed.body.length > 100, 'body must be >100 characters');
  assert.ok(healed.context.body.length > 100, 'context.body must be >100 characters');
  assert.equal(healed.category, 'RESEARCH');
  assert.ok(Array.isArray(healed.execution_plan) && healed.execution_plan.length > 0);
});

test('healCardFile and runQuarantineAutoHealer: processes quarantined files into pending directory', () => {
  const tmpQuarantine = createTempDir('quarantine');
  const tmpPending = createTempDir('pending');
  const tmpLedger = path.join(createTempDir('ledger'), 'ledger.jsonl');

  const cardPayload = {
    id: 'act-kbsync-conflict-log-entry-11-death-date',
    target: 'kb-sync',
    category: 'RESEARCH',
    title: 'Kbsync Conflict Log Entry 11 Death Date',
    summary: 'Mobile action item: Kbsync Conflict Log Entry 11 Death Date',
    context: {
      body_fetch_failed: true,
      gdoc_filename: '2026-11-04T232701Z__action__kb-sync__act-kbsync-conflict-log-entry-11-death-date.md.gdoc',
      gdoc_stem: '2026-11-04T232701Z__action__kb-sync__act-kbsync-conflict-log-entry-11-death-date'
    }
  };

  const testFilename = '2026-11-04T232701Z__action__kb-sync__act-kbsync-conflict-log-entry-11-death-date.md.gdoc';
  fs.writeFileSync(path.join(tmpQuarantine, testFilename), JSON.stringify(cardPayload, null, 2), 'utf8');

  // Test Dry Run
  const dryReport = runQuarantineAutoHealer({
    quarantineDir: tmpQuarantine,
    pendingDir: tmpPending,
    ledgerPath: tmpLedger,
    dryRun: true
  });
  assert.equal(dryReport.healedCount, 1);
  assert.equal(fs.existsSync(path.join(tmpQuarantine, testFilename)), true);
  assert.equal(fs.existsSync(path.join(tmpPending, '2026-11-04T232701Z__action__kb-sync__act-kbsync-conflict-log-entry-11-death-date.md')), false);

  // Test Live Run
  const liveReport = runQuarantineAutoHealer({
    quarantineDir: tmpQuarantine,
    pendingDir: tmpPending,
    ledgerPath: tmpLedger,
    dryRun: false
  });
  assert.equal(liveReport.healedCount, 1);
  assert.equal(fs.existsSync(path.join(tmpQuarantine, testFilename)), false);

  const destFile = path.join(tmpPending, '2026-11-04T232701Z__action__kb-sync__act-kbsync-conflict-log-entry-11-death-date.md');
  assert.equal(fs.existsSync(destFile), true);

  const parsed = JSON.parse(fs.readFileSync(destFile, 'utf8'));
  assert.equal(parsed.context.body_fetch_failed, false);
  assert.equal(parsed.context.healed, true);
  assert.ok(parsed.summary.length > 50);

  // Check ledger entry
  assert.equal(fs.existsSync(tmpLedger), true);
  const ledgerContent = fs.readFileSync(tmpLedger, 'utf8');
  assert.ok(ledgerContent.includes('act-kbsync-conflict-log-entry-11-death-date'));
  assert.ok(ledgerContent.includes('HEALED_AND_STAGED'));
});
