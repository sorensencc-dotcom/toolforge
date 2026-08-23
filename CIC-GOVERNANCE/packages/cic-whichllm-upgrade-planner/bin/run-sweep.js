#!/usr/bin/env node
import { SweepRunner } from '../src/sweep-runner.js';

const runner = new SweepRunner();
const result = await runner.runSweep();

console.log('CIC-WHICHLLM Upgrade Sweep (Mode B: Approval)');
console.log('============================================');
console.log(`Models scanned: ${result.modelsScanned}`);
console.log(`Proposals generated: ${result.proposalsGenerated.length}`);
console.log('');
console.log(runner.formatBriefingSection(result));
