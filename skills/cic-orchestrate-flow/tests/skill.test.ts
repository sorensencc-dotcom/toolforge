import { describe, it, expect, jest } from '@jest/globals';
import main from '../src/index';

describe('cic-orchestrate-flow', () => {
  it('GATE-01 run produces well-formed flow result', async () => {
    const result = await main({ sourceId: 'demo-source', gateId: 'GATE-01' });
    expect(result.flowId).toMatch(/^run-/);
    expect(['PASS', 'FAIL', 'ERROR']).toContain(result.overallStatus);
    expect(result.steps.map((s) => s.step)).toEqual(['ingest', 'gate', 'repair', 'consolidate']);
    expect(typeof result.flowPath).toBe('string');
    expect(() => new Date(result.timestamp).toISOString()).not.toThrow();

    const gateStep = result.steps.find((s) => s.step === 'gate')!;
    const repairStep = result.steps.find((s) => s.step === 'repair')!;
    if (gateStep.status === 'PASS') {
      expect(repairStep.status).toBe('SKIPPED');
    } else {
      expect(repairStep.status).not.toBe('SKIPPED');
    }

    const consolidateStep = result.steps.find((s) => s.step === 'consolidate')!;
    expect(typeof result.bundleId).toBe('string');
    expect(consolidateStep.status).toBe('stub');
  }, 20000);

  it('unknown gateId (not PASS) triggers repair and still consolidates', async () => {
    const result = await main({ sourceId: 'demo-source', gateId: 'GATE-99' });
    const gateStep = result.steps.find((s) => s.step === 'gate')!;
    const repairStep = result.steps.find((s) => s.step === 'repair')!;
    const consolidateStep = result.steps.find((s) => s.step === 'consolidate')!;
    expect(gateStep.status).toBe('ERROR');
    expect(repairStep.status).toBe('stub');
    expect(consolidateStep.status).toBe('stub');
    expect(result.overallStatus).toBe('ERROR');
  });

  it('ingest failure short-circuits the flow', async () => {
    jest.resetModules();
    jest.doMock('../../cic-ingest-world/src/index', () => ({
      __esModule: true,
      default: jest.fn(() => { throw new Error('ingest exploded'); }),
    }));
    const { default: mainWithMockedIngest } = await import('../src/index');
    const result = await mainWithMockedIngest({ sourceId: 'demo-source' });
    expect(result.steps).toEqual([{ step: 'ingest', status: 'ERROR' }]);
    expect(result.overallStatus).toBe('ERROR');
    jest.dontMock('../../cic-ingest-world/src/index');
    jest.resetModules();
  });
});
