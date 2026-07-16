import { describe, it, expect } from '@jest/globals';
import main from '../src/index';

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
