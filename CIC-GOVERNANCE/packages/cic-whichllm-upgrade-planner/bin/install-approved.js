#!/usr/bin/env node
import { ModelInstaller } from '../src/model-installer.js';

const proposalId = process.argv[2];
const installer = new ModelInstaller({ mode: 'ollama_pull' });

console.log('CIC-WHICHLLM Automated Model Installer (Ollama Direct Pull)');
console.log('==========================================================');

if (proposalId && !proposalId.startsWith('--')) {
  const result = await installer.installApprovedProposal(proposalId);
  console.log(JSON.stringify(result, null, 2));
} else {
  const results = await installer.installAllApproved();
  console.log(`\nCompleted installation of ${results.length} approved model(s):\n`);
  for (const r of results) {
    const statusMark = r.details?.status === 'installed' ? '✓' : '✗';
    console.log(`${statusMark} Model:        ${r.model} (${r.quantization})`);
    console.log(`  Ollama Tag:   ${r.details?.tag ?? 'N/A'}`);
    console.log(`  Status:       ${r.details?.status}`);
    console.log(`  Lineage Hash: ${r.lineageHash}\n`);
  }
}
