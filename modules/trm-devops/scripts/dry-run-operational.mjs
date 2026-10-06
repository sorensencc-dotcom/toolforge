import {
  resolveSynthesisPrompt,
  getProfileForNotebook,
  parseOperationalAuditOutput,
  formatOperationalGapsTable,
  loadNotebookManifest
} from '../dist/index.js';

console.log('=== Manifest Inspection ===');
const manifest = loadNotebookManifest();
console.log(`Total Notebooks in Manifest: ${manifest.notebooks.length}`);

const targets = ['nb_ironledger', 'nb_toolforge', 'nb_rewritelabs', 'nb_cic_core'];
for (const t of targets) {
  const profile = getProfileForNotebook(t, manifest);
  const prompt = resolveSynthesisPrompt(profile);
  console.log(`\nTarget: [${t}] -> Profile: \`${profile}\``);
  console.log(`Prompt Preview: ${prompt.split('\n')[0]}`);
}

console.log('\n=== Operational Dry Run for IronLedger Target ===');
const sampleIronLedgerOutput = `
1. INVARIANT & STATE DRIFT:
NONE

2. RUNTIME FAILURES & EDGE CASES:
- Incomplete CSV schema validation on multi-shipment lot triage

3. MANUAL FRICTION:
- Operator manually matched split proposals in workbench

4. ACTIONABLE DELTAS:
- [IronLedger-Ingest] Implement multi-shipment combinatorial matching in CSV poller
- [IronLedger-UI] Add visual triage card for split proposals in RegisterGrid sidecar
`;

const parsedIronLedger = parseOperationalAuditOutput(sampleIronLedgerOutput);
const ironLedgerTable = formatOperationalGapsTable([
  { target: 'IronLedger Engine', profile: 'operational_systems', deltas: parsedIronLedger.actionableDeltas }
]);
console.log(ironLedgerTable);

console.log('=== Operational Dry Run for Toolforge Target (Clean Run / Zero Findings) ===');
const sampleToolforgeClean = `
1. INVARIANT & STATE DRIFT:
NONE

2. RUNTIME FAILURES & EDGE CASES:
NONE

3. MANUAL FRICTION:
NONE

4. ACTIONABLE DELTAS:
NONE
`;
const parsedToolforge = parseOperationalAuditOutput(sampleToolforgeClean);
const toolforgeTable = formatOperationalGapsTable([
  { target: 'Toolforge & Agravity', profile: 'operational_systems', deltas: parsedToolforge.actionableDeltas }
]);
console.log(toolforgeTable);
