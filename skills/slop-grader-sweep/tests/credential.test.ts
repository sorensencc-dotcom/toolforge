// skills/slop-grader-sweep/tests/credential.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../credential-resolver', () => ({
  resolveApiKey: vi.fn(),
}));

import { resolveApiKey } from '../../../credential-resolver';
import { resolveOpenRouterCredential } from '../src/credential';

describe('resolveOpenRouterCredential', () => {
  beforeEach(() => {
    vi.mocked(resolveApiKey).mockReset();
  });

  it('returns ok:true with the key when resolution succeeds', () => {
    vi.mocked(resolveApiKey).mockReturnValue('test-key');

    const result = resolveOpenRouterCredential();

    expect(result).toEqual({ ok: true, apiKey: 'test-key' });
    expect(resolveApiKey).toHaveBeenCalledWith('openrouter');
  });

  it('returns ok:false with the error message when resolution throws', () => {
    vi.mocked(resolveApiKey).mockImplementation(() => {
      throw new Error('[whichllm] Could not resolve key for "openrouter". Missing environment variable: OPENROUTER_API_KEY');
    });

    const result = resolveOpenRouterCredential();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('OPENROUTER_API_KEY');
    }
  });
});
