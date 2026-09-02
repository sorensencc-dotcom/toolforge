import { describe, it, expect } from '@jest/globals';
import main from '../src/index';

describe('cic-repair-pipeline', () => {
  it('returns stub result with required fields', async () => {
    const result = await main({ pipelineId: 'demo-pipeline' });
    expect(result.status).toBe('stub');
    expect(result.runId).toMatch(/^run-/);
    expect(typeof result.patchSetPath).toBe('string');
    expect(Array.isArray(result.commands)).toBe(true);
    expect(result.governanceTag).toMatch(/^\[RUN-ID:run-.*\]\[PROFILE-ID:default\]$/);
    expect(() => new Date(result.timestamp).toISOString()).not.toThrow();
  });
});
