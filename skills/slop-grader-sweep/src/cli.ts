#!/usr/bin/env node
import { runChanged, printChangedSummary } from './run-changed';
import { runSweep } from './run-sweep';

async function main(): Promise<void> {
  const mode = process.argv[2];

  if (mode === 'changed') {
    const result = await runChanged();
    printChangedSummary(result);
    process.exit(0);
  }

  if (mode === 'sweep') {
    await runSweep();
    return;
  }

  console.error(`Unknown mode "${mode}". Usage: run-slop-grader <changed|sweep>`);
  process.exit(1);
}

main();
