import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FaultInjector, SimulationEngine } from '../src/index.js';

describe('Pipeline Simulation', () => {
  it('corrupts hashes deterministically', () => {
    const hash = 'a'.repeat(64);
    const corrupted = FaultInjector.corruptHash(hash);
    assert.equal(corrupted.length, 64);
    assert.notEqual(corrupted, hash);
  });

  it('runs TC-01, TC-04, and TC-07 successfully', async () => {
    const engine = new SimulationEngine();
    const r1 = await engine.runTestCase('TC-01-mid-lineage-write');
    assert.equal(r1.passed, true);

    const r4 = await engine.runTestCase('TC-04-hash-chain-corruption');
    assert.equal(r4.passed, true);

    const r7 = await engine.runTestCase('TC-07-deterministic-output');
    assert.equal(r7.passed, true);
  });
});
