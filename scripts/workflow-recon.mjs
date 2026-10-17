#!/usr/bin/env node
// scripts/workflow-recon.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  discoverWorkflows,
  auditWorkflowDocumentation,
} from '../skills/repo-docs-diagram-sync/src/workflow-recon.mjs';
import {
  materializeWorkflowDocumentation,
} from '../skills/repo-docs-diagram-sync/src/doc-generator.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');

export function parseArgs(argv) {
  const options = {
    targetPath: ROOT,
    generate: false,
    dryRun: false,
  };

  for (const arg of argv) {
    if (arg === '--generate') options.generate = true;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg.startsWith('--path=')) options.targetPath = path.resolve(ROOT, arg.slice('--path='.length));
  }

  return options;
}

export async function runRecon(targetPath, { generate = false, dryRun = false } = {}) {
  const discovered = discoverWorkflows(targetPath);
  const audited = auditWorkflowDocumentation(targetPath, discovered);

  const undocumented = audited.filter((w) => !w.isDocumented);
  const stale = audited.filter((w) => w.isDocumented && w.needsUpdate);

  console.log(`WORKFLOW_RECON: Discovered ${discovered.length} total workflows in ${path.relative(ROOT, targetPath) || '.'}:`);
  console.log(`  - Documented: ${audited.length - undocumented.length}`);
  console.log(`  - Undocumented: ${undocumented.length}`);
  console.log(`  - Stale / Needs Update: ${stale.length}`);

  if (undocumented.length > 0) {
    console.log('\nUndocumented workflows detected:');
    for (const w of undocumented.slice(0, 8)) {
      console.log(`  * [${w.type}] ${w.name} (${w.sourceFile})`);
    }
    if (undocumented.length > 8) {
      console.log(`  ... and ${undocumented.length - 8} more`);
    }
  }

  let generatedCount = 0;
  if (generate && !dryRun) {
    const outputDir = path.join(targetPath, 'docs', 'workflows');
    const targets = [...undocumented, ...stale];
    console.log(`\nGenerating documentation and Cathryn Lavery diagrams in ${path.relative(ROOT, outputDir)}...`);
    for (const w of targets) {
      materializeWorkflowDocumentation(w, { outputDir, renderPng: true });
      generatedCount++;
    }
    console.log(`Successfully generated ${generatedCount} workflow documentation and diagram suites.`);
  }

  return {
    total: discovered.length,
    undocumentedCount: undocumented.length,
    staleCount: stale.length,
    generatedCount,
  };
}

export async function main() {
  const options = parseArgs(process.argv.slice(2));
  await runRecon(options.targetPath, options);
  console.log('WORKFLOW_RECON_OK');
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main().catch((err) => {
    console.error(`WORKFLOW_RECON_FAILED: ${err.message}`);
    process.exit(1);
  });
}
