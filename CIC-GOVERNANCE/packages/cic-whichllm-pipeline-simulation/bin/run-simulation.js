#!/usr/bin/env node
import { SimulationEngine } from '../src/simulation-engine.js';

const engine = new SimulationEngine();
const cases = [
  'TC-01-mid-lineage-write',
  'TC-02-rollback-semantics',
  'TC-03-byte-restoration',
  'TC-04-hash-chain-corruption',
  'TC-05-actor-registry-binding',
  'TC-06-gguf-provenance',
  'TC-07-deterministic-output',
  'TC-08-isolation-idempotency',
];

console.log('CIC-WHICHLLM Pipeline Simulation Harness v1.0');
console.log('============================================');

for (const c of cases) {
  const res = await engine.runTestCase(c);
  const mark = res.passed ? '✓' : '✗';
  console.log(`${mark} ${res.id}: ${res.title}`);
  if (!res.passed) {
    console.error(`   Error: ${res.error}`);
  }
}
