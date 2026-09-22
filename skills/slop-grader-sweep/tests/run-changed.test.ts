import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/credential', () => ({
  resolveOpenRouterCredential: vi.fn(),
}));
vi.mock('../src/file-list', () => ({
  resolveChangedFiles: vi.fn(),
}));
vi.mock('../src/slop-grader-runner', () => ({
  runSlopGrader: vi.fn(),
}));

import { resolveOpenRouterCredential } from '../src/credential';
import { resolveChangedFiles } from '../src/file-list';
import { runSlopGrader } from '../src/slop-grader-runner';
import { runChanged } from '../src/run-changed';

describe('runChanged', () => {
  beforeEach(() => {
    vi.mocked(resolveOpenRouterCredential).mockReset();
    vi.mocked(resolveChangedFiles).mockReset();
    vi.mocked(runSlopGrader).mockReset();
  });

  it('skips with no subprocess call when no staged markdown files', async () => {
    vi.mocked(resolveChangedFiles).mockReturnValue([]);

    const result = await runChanged('/repo');

    expect(result).toEqual({ skipped: true, reason: 'no staged markdown files', findings: [] });
    expect(resolveOpenRouterCredential).not.toHaveBeenCalled();
    expect(runSlopGrader).not.toHaveBeenCalled();
  });

  it('skips with the credential reason when credential resolution fails', async () => {
    vi.mocked(resolveChangedFiles).mockReturnValue(['docs/a.md']);
    vi.mocked(resolveOpenRouterCredential).mockReturnValue({ ok: false, reason: 'missing env var' });

    const result = await runChanged('/repo');

    expect(result).toEqual({ skipped: true, reason: 'missing env var', findings: [] });
    expect(runSlopGrader).not.toHaveBeenCalled();
  });

  it('skips with the runner reason when the subprocess fails', async () => {
    vi.mocked(resolveChangedFiles).mockReturnValue(['docs/a.md']);
    vi.mocked(resolveOpenRouterCredential).mockReturnValue({ ok: true, apiKey: 'sk-test' });
    vi.mocked(runSlopGrader).mockResolvedValue({ ok: false, reason: 'timed out after 30000ms' });

    const result = await runChanged('/repo');

    expect(result).toEqual({ skipped: true, reason: 'timed out after 30000ms', findings: [] });
  });

  it('returns findings when the subprocess succeeds', async () => {
    vi.mocked(resolveChangedFiles).mockReturnValue(['docs/a.md']);
    vi.mocked(resolveOpenRouterCredential).mockReturnValue({ ok: true, apiKey: 'sk-test' });
    vi.mocked(runSlopGrader).mockResolvedValue({
      ok: true,
      findings: [{ file: 'docs/a.md', line: 1, rule: 'throat_clearing', severity: 'error', message: 'cut it' }],
    });

    const result = await runChanged('/repo');

    expect(result.skipped).toBe(false);
    expect(result.findings).toHaveLength(1);
    expect(runSlopGrader).toHaveBeenCalledWith(['docs/a.md'], 'sk-test');
  });
});
