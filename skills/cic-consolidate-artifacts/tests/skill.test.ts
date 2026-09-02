import { describe, it, expect } from '@jest/globals';
import main from '../src/index';

describe('cic-consolidate-artifacts', () => {
  it('returns stub result with required fields', async () => {
    const result = await main({ runIds: ['run-a', 'run-b'] });
    expect(result.status).toBe('stub');
    expect(result.bundleId).toMatch(/^bundle-/);
    expect(typeof result.bundlePath).toBe('string');
    expect(result.governanceTag).toMatch(/^\[RUN-ID:bundle-.*\]\[PROFILE-ID:default\]$/);
    expect(() => new Date(result.timestamp).toISOString()).not.toThrow();
  });
});
