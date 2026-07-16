import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import main from '../src/index';
import { lineagePaths } from '../../_cic-shared/src/lineagePaths';

describe('cic-ingest-world', () => {
  it('returns stub result with required fields', async () => {
    const result = await main({ sourceId: 'demo-source' });
    expect(result.status).toBe('stub');
    expect(result.runId).toMatch(/^run-/);
    expect(typeof result.artifactsPath).toBe('string');
    expect(typeof result.lineageRef).toBe('string');
    expect(() => new Date(result.timestamp).toISOString()).not.toThrow();
  });

  it('reflects sourceId into lineageRef', async () => {
    const result = await main({ sourceId: 'demo-source' });
    expect(result.lineageRef).toContain('demo-source');
  });
});

describe('cic-ingest-world lineage index', () => {
  it('writes a lineage index entry under cic/lineage/ingest/<runId>.json', async () => {
    const result = await main({ sourceId: 'demo-source' });
    const { file } = lineagePaths('ingest', result.runId);
    expect(fs.existsSync(file)).toBe(true);
    const entry = JSON.parse(fs.readFileSync(file, 'utf-8'));
    expect(entry).toEqual({
      runId: result.runId,
      lineageRef: result.lineageRef,
      sourceId: 'demo-source',
      status: 'stub',
      timestamp: result.timestamp,
    });
  });
});
