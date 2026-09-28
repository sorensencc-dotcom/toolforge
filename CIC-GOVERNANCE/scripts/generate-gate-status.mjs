import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export function generateGateStatusMarkdown({ gateRegistry, amendmentRegistry, runtimeStatus }) {
  const lines = [];
  lines.push('---');
  lines.push('title: "Gate Implementation Status (generated)"');
  lines.push('document_id: "CIC-GOV-GATE-STATUS"');
  lines.push('category: "manifest"');
  lines.push('generator: "CIC-GOVERNANCE/scripts/generate-gate-status.mjs"');
  lines.push('---');
  lines.push('');
  lines.push('# Gate Implementation Status');
  lines.push('');
  lines.push('> Generated from `gate-registry.json`, `amendment-registry.json`, and');
  lines.push('> `runtime-status.json`. Do not hand-edit — edit the source registries and');
  lines.push('> regenerate instead.');
  lines.push('');
  lines.push(`Gate registry status: ${gateRegistry.status}`);
  lines.push(`Amendment registry status: ${amendmentRegistry.status}`);
  lines.push(`Runtime status (runtime-status.json): ${runtimeStatus.status}`);
  lines.push('');
  lines.push('| Gate | Name | Status | Closure amendment |');
  lines.push('| --- | --- | --- | --- |');
  for (const [id, gate] of Object.entries(gateRegistry.gates ?? {})) {
    lines.push(`| ${id} | ${gate.name} | ${gate.status} | ${gate.closure_amendment ?? '(none — open)'} |`);
  }
  return lines.join('\n') + '\n';
}

function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const root = resolve(here, '..');
  const gateRegistry = JSON.parse(readFileSync(resolve(root, 'MANIFEST/gate-registry.json'), 'utf8'));
  const amendmentRegistry = JSON.parse(readFileSync(resolve(root, 'AMENDMENTS/amendment-registry.json'), 'utf8'));
  const runtimeStatus = JSON.parse(readFileSync(resolve(root, 'MANIFEST/runtime-status.json'), 'utf8'));
  const md = generateGateStatusMarkdown({ gateRegistry, amendmentRegistry, runtimeStatus });
  const outPath = resolve(root, 'MANIFEST/gate-implementation-status.candidate.md');
  writeFileSync(outPath, md);
  console.log(`Wrote ${outPath} — review and diff against gate-implementation-status.md before any cutover decision.`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
