#!/usr/bin/env node
/**
 * Health Check Script
 * CIC-WHICHLLM-INTEGRATION-PACK v1.0
 *
 * Usage:
 *   node scripts/health-check.js
 *
 * Exit codes:
 *   0  All subsystems healthy
 *   1  One or more subsystems degraded
 */

import { WhichLLMAdapter } from '../src/adapter/whichllm-adapter.js';
import { registryHealthSummary } from '../src/harvester/harvester-registry.js';
import { GENESIS_HASH } from '../src/lineage/lineage-contract.js';

const ANSI = {
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
};

function status(ok, label, detail = '') {
  const icon   = ok ? '✓' : '✗';
  const colour = ok ? ANSI.green : ANSI.red;
  console.log(`  ${colour}${icon}${ANSI.reset}  ${label}${detail ? `  ${ANSI.yellow}(${detail})${ANSI.reset}` : ''}`);
  return ok;
}

async function main() {
  console.log(`\n${ANSI.bold}CIC-WHICHLLM Integration Pack — Health Check${ANSI.reset}`);
  console.log(`${'─'.repeat(50)}`);

  let allOk = true;

  // ── 1. Node version ─────────────────────────────────────────────────────────
  const nodeVer = process.versions.node;
  const [major]  = nodeVer.split('.').map(Number);
  allOk = status(major >= 20, 'Node.js version', `v${nodeVer}`) && allOk;

  // ── 2. Module imports ────────────────────────────────────────────────────────
  try {
    const { ADAPTER_VERSION, CIC_SPEC_VERSION, AMENDMENT_REF } = await import('../src/adapter/whichllm-adapter.js');
    allOk = status(true, 'Adapter module', `v${ADAPTER_VERSION} | CIC ${CIC_SPEC_VERSION} | ${AMENDMENT_REF}`) && allOk;
  } catch (e) {
    allOk = status(false, 'Adapter module', e.message) && allOk;
  }

  try {
    const { GOVERNANCE_VERSION } = await import('../src/governance/governance-wrapper.js');
    allOk = status(true, 'Governance module', `v${GOVERNANCE_VERSION}`) && allOk;
  } catch (e) {
    allOk = status(false, 'Governance module', e.message) && allOk;
  }

  try {
    const { LINEAGE_CONTRACT_VERSION } = await import('../src/lineage/lineage-contract.js');
    allOk = status(true, 'Lineage contract module', `v${LINEAGE_CONTRACT_VERSION}`) && allOk;
  } catch (e) {
    allOk = status(false, 'Lineage contract module', e.message) && allOk;
  }

  try {
    await import('../src/harvester/harvester-registry.js');
    allOk = status(true, 'Harvester registry module') && allOk;
  } catch (e) {
    allOk = status(false, 'Harvester registry module', e.message) && allOk;
  }

  try {
    const { OBSERVER_VERSION } = await import('../src/observability/adapter-observer.js');
    allOk = status(true, 'Observer module', `v${OBSERVER_VERSION}`) && allOk;
  } catch (e) {
    allOk = status(false, 'Observer module', e.message) && allOk;
  }

  // ── 3. Registry summary ──────────────────────────────────────────────────────
  try {
    const summary = registryHealthSummary();
    const compliant = summary.nonCompliant === 0;
    allOk = status(
      compliant,
      'Registry compliance',
      `${summary.active} active, ${summary.compliant} compliant, ${summary.nonCompliant} non-compliant`
    ) && allOk;
  } catch (e) {
    allOk = status(false, 'Registry health summary', e.message) && allOk;
  }

  // ── 4. Genesis hash invariant ────────────────────────────────────────────────
  const expectedGenesis = 'a4f3e2c1'; // first 8 chars of real genesis hash for smoke check
  const genesisOk = GENESIS_HASH.length === 64 && /^[0-9a-f]{64}$/.test(GENESIS_HASH);
  allOk = status(genesisOk, 'Lineage genesis hash', GENESIS_HASH.slice(0, 16) + '…') && allOk;

  // ── 5. Schema file ───────────────────────────────────────────────────────────
  try {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const { dirname, join } = await import('node:path');
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const schema = JSON.parse(readFileSync(join(__dirname, '../schemas/whichllm-ingestion-schema.json'), 'utf8'));
    const valid = schema.$id && schema.required?.length > 0;
    allOk = status(valid, 'Ingestion schema file', schema.$id) && allOk;
  } catch (e) {
    allOk = status(false, 'Ingestion schema file', e.message) && allOk;
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log(`${'─'.repeat(50)}`);
  if (allOk) {
    console.log(`${ANSI.green}${ANSI.bold}All checks passed.${ANSI.reset} Pack is ready to deploy.\n`);
    process.exit(0);
  } else {
    console.log(`${ANSI.red}${ANSI.bold}One or more checks failed.${ANSI.reset} Review output above.\n`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Health check script error:', err);
  process.exit(1);
});
