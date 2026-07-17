import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import main from '../src/index';
import { reportPaths } from '../../_cic-shared/src/reportPaths';

describe('cic-run-gate', () => {
  it('GATE-01 returns a well-formed PASS/FAIL/ERROR result', async () => {
    const result = await main({ gateId: 'GATE-01' });
    expect(result.gateId).toBe('GATE-01');
    expect(['PASS', 'FAIL', 'ERROR']).toContain(result.status);
    expect(Array.isArray(result.violations)).toBe(true);
    expect(typeof result.reportPath).toBe('string');
    expect(typeof result.artifactsPath).toBe('string');
    expect(result.governanceTag).toMatch(/^\[RUN-ID:run-.*\]\[GATE-ID:GATE-01\]\[PROFILE-ID:default\]$/);
    expect(() => new Date(result.timestamp).toISOString()).not.toThrow();
  }, 20000);

  it('unknown gateId shape (GATE-99) returns ERROR without spawning', async () => {
    const result = await main({ gateId: 'GATE-99' });
    expect(result.status).toBe('ERROR');
    expect(result.violations).toEqual([]);
  });

  it('malformed gateId is rejected before spawn', async () => {
    const result = await main({ gateId: 'not-a-gate; rm -rf /' });
    expect(result.status).toBe('ERROR');
    expect(result.message).toMatch(/invalid gateId/i);
  });
});

describe('cic-run-gate report index', () => {
  it('writes a report index entry under cic/reports/gates/<runId>.json', async () => {
    const result = await main({ gateId: 'GATE-01' });
    const { file } = reportPaths('gates', result.runId);
    expect(fs.existsSync(file)).toBe(true);
    const entry = JSON.parse(fs.readFileSync(file, 'utf-8'));
    expect(entry).toEqual({
      runId: result.runId,
      gateId: 'GATE-01',
      status: result.status,
      reportPath: result.reportPath,
      timestamp: result.timestamp,
    });
  }, 20000);
});
