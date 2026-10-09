import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PROMPT_OPERATIONAL_SYSTEMS,
  PROMPT_OPERATIONAL_CLIENT,
  PROMPT_RESEARCH_CIC,
  resolveSynthesisPrompt,
  validateLogContext,
  parseOperationalAuditOutput,
  formatOperationalGapsTable,
  loadNotebookManifest,
  getProfileForNotebook
} from '../src/synthesis-dispatcher.ts';
import * as trmDevops from '../src/index.ts';

test('resolveSynthesisPrompt routes prompts correctly based on profile', () => {
  assert.equal(resolveSynthesisPrompt('operational_systems'), PROMPT_OPERATIONAL_SYSTEMS);
  assert.equal(resolveSynthesisPrompt('operational_client'), PROMPT_OPERATIONAL_CLIENT);
  assert.equal(resolveSynthesisPrompt('research_narrative'), PROMPT_RESEARCH_CIC);
  assert.equal(resolveSynthesisPrompt('unknown_profile'), PROMPT_RESEARCH_CIC);
  assert.equal(resolveSynthesisPrompt(''), PROMPT_RESEARCH_CIC);
});

test('prompt templates contain required sections and NONE escape hatch', () => {
  // Operational / Systems Template A
  assert.ok(PROMPT_OPERATIONAL_SYSTEMS.includes('Run an operational audit on the latest session logs and sources.'));
  assert.ok(PROMPT_OPERATIONAL_SYSTEMS.includes('If a section has no entries, output "NONE".'));
  assert.ok(PROMPT_OPERATIONAL_SYSTEMS.includes('1. INVARIANT & STATE DRIFT:'));
  assert.ok(PROMPT_OPERATIONAL_SYSTEMS.includes('2. RUNTIME FAILURES & EDGE CASES:'));
  assert.ok(PROMPT_OPERATIONAL_SYSTEMS.includes('3. MANUAL FRICTION:'));
  assert.ok(PROMPT_OPERATIONAL_SYSTEMS.includes('4. ACTIONABLE DELTAS:'));
  assert.ok(PROMPT_OPERATIONAL_SYSTEMS.includes('[COMPONENT] Task description.'));

  // Production & Client Ops Template B
  assert.ok(PROMPT_OPERATIONAL_CLIENT.includes('Run a delivery and pipeline triage on the latest entries.'));
  assert.ok(PROMPT_OPERATIONAL_CLIENT.includes('If a section has no entries, output "NONE".'));
  assert.ok(PROMPT_OPERATIONAL_CLIENT.includes('1. PIPELINE CHECKPOINTS:'));
  assert.ok(PROMPT_OPERATIONAL_CLIENT.includes('2. UPSTREAM/DOWNSTREAM BREAKS:'));
  assert.ok(PROMPT_OPERATIONAL_CLIENT.includes('3. BLOCKED DELIVERABLES:'));

  // CIC Research Template
  assert.ok(PROMPT_RESEARCH_CIC.includes('Run a historical research synthesis on the latest sources and logs.'));
  assert.ok(PROMPT_RESEARCH_CIC.includes('1. CONTRADICTIONS & DISCREPANCIES:'));
  assert.ok(PROMPT_RESEARCH_CIC.includes('2. UNDER-SOURCED CLAIMS:'));
  assert.ok(PROMPT_RESEARCH_CIC.includes('3. ADJACENT TOPICS & VECTORS:'));
  assert.ok(PROMPT_RESEARCH_CIC.includes('4. FOLLOW-UP RESEARCH ACTIONS:'));
});

test('early abort guardrail on ambiguous or truncated log data', () => {
  const runId = 'RUN-2026-10-05-1234';

  // Truncated flag
  const resTrunc = validateLogContext(runId, { isTruncated: true });
  assert.equal(resTrunc.valid, false);
  assert.equal(resTrunc.abortMessage, `[AUDIT_HALTED: Missing log context for ${runId}]`);

  // Incomplete stack trace
  const resStack = validateLogContext(runId, { stackTrace: 'Error: at func1 (file.ts:1)\n... [truncated]' });
  assert.equal(resStack.valid, false);
  assert.equal(resStack.abortMessage, `[AUDIT_HALTED: Missing log context for ${runId}]`);

  // Invalid date
  const resDate = validateLogContext(runId, { date: 'unknown-date-string' });
  assert.equal(resDate.valid, false);
  assert.equal(resDate.abortMessage, `[AUDIT_HALTED: Missing log context for ${runId}]`);

  // Empty raw text
  const resEmpty = validateLogContext(runId, { rawText: '   ' });
  assert.equal(resEmpty.valid, false);
  assert.equal(resEmpty.abortMessage, `[AUDIT_HALTED: Missing log context for ${runId}]`);

  // Clean log context passes
  const resClean = validateLogContext(runId, {
    rawText: '2026-10-05T20:00:00Z [INFO] All tests passed',
    date: '2026-10-05T20:00:00Z',
    isTruncated: false
  });
  assert.equal(resClean.valid, true);
  assert.equal(resClean.abortMessage, undefined);
});

test('zero findings guardrail prevents hallucination on clean runs', () => {
  const cleanAuditOutput = `
1. INVARIANT & STATE DRIFT:
NONE

2. RUNTIME FAILURES & EDGE CASES:
NONE

3. MANUAL FRICTION:
NONE

4. ACTIONABLE DELTAS:
NONE
`;

  const parsed = parseOperationalAuditOutput(cleanAuditOutput);
  assert.equal(parsed.isZeroFindings, true);
  assert.equal(parsed.invariantDrift.length, 0);
  assert.equal(parsed.runtimeFailures.length, 0);
  assert.equal(parsed.manualFriction.length, 0);
  assert.equal(parsed.actionableDeltas.length, 0);

  const table = formatOperationalGapsTable([
    { target: 'IronLedger Engine', profile: 'operational_systems', deltas: parsed.actionableDeltas }
  ]);

  assert.ok(table.includes('### TRM Operational Gaps & Synthesis'));
  assert.ok(table.includes('**IronLedger Engine**'));
  assert.ok(table.includes('*None (Clean run)*'));
  assert.ok(table.includes('`CLEAN`'));
});

test('operational audit output parses structured defects and formats table', () => {
  const operationalOutput = `
1. INVARIANT & STATE DRIFT:
- Schema mismatch between Postgres and SQLite types in LedgerEntry

2. RUNTIME FAILURES & EDGE CASES:
- ENOENT when reading missing cache file in offline buffer

3. MANUAL FRICTION:
- Manual rerun needed for missing token environment variable

4. ACTIONABLE DELTAS:
- [LedgerEngine] Enforce dual-schema type parity validation in test harness
- [BufferCache] Add fallback directory creation before file read
`;

  const parsed = parseOperationalAuditOutput(operationalOutput);
  assert.equal(parsed.isZeroFindings, false);
  assert.equal(parsed.invariantDrift.length, 1);
  assert.equal(parsed.runtimeFailures.length, 1);
  assert.equal(parsed.manualFriction.length, 1);
  assert.equal(parsed.actionableDeltas.length, 2);

  assert.equal(parsed.actionableDeltas[0].component, 'LedgerEngine');
  assert.equal(parsed.actionableDeltas[0].task, 'Enforce dual-schema type parity validation in test harness');
  assert.equal(parsed.actionableDeltas[1].component, 'BufferCache');
  assert.equal(parsed.actionableDeltas[1].task, 'Add fallback directory creation before file read');

  const table = formatOperationalGapsTable([
    { target: 'IronLedger Engine', profile: 'operational_systems', deltas: parsed.actionableDeltas }
  ]);

  assert.ok(table.includes('### TRM Operational Gaps & Synthesis'));
  assert.ok(table.includes('| **IronLedger Engine** | `operational_systems` | `LedgerEngine` | Enforce dual-schema type parity validation in test harness | `OPEN` |'));
  assert.ok(table.includes('| **IronLedger Engine** | `operational_systems` | `BufferCache` | Add fallback directory creation before file read | `OPEN` |'));
});

test('notebook manifest and profile resolution across targets', () => {
  const manifest = loadNotebookManifest();
  assert.ok(manifest.notebooks.length >= 4);

  assert.equal(getProfileForNotebook('nb_ironledger', manifest), 'operational_systems');
  assert.equal(getProfileForNotebook('IronLedger Engine', manifest), 'operational_systems');
  assert.equal(getProfileForNotebook('nb_toolforge', manifest), 'operational_systems');
  assert.equal(getProfileForNotebook('Toolforge & Agravity', manifest), 'operational_systems');
  assert.equal(getProfileForNotebook('nb_rewritelabs', manifest), 'operational_client');
  assert.equal(getProfileForNotebook('Rewrite Labs Production', manifest), 'operational_client');
  assert.equal(getProfileForNotebook('nb_cic_core', manifest), 'research_narrative');
  assert.equal(getProfileForNotebook('Cast Iron Charlie Core', manifest), 'research_narrative');
});

test('index.ts re-exports synthesis-dispatcher symbols', () => {
  assert.equal(typeof trmDevops.resolveSynthesisPrompt, 'function');
  assert.equal(typeof trmDevops.validateLogContext, 'function');
  assert.equal(typeof trmDevops.parseOperationalAuditOutput, 'function');
  assert.equal(typeof trmDevops.formatOperationalGapsTable, 'function');
  assert.equal(typeof trmDevops.loadNotebookManifest, 'function');
  assert.equal(typeof trmDevops.getProfileForNotebook, 'function');
  assert.ok(typeof trmDevops.PROMPT_OPERATIONAL_SYSTEMS === 'string');
  assert.ok(typeof trmDevops.PROMPT_OPERATIONAL_CLIENT === 'string');
  assert.ok(typeof trmDevops.PROMPT_RESEARCH_CIC === 'string');
});
