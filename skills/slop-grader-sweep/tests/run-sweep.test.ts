import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('node:fs', () => ({
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));
vi.mock('../src/credential', () => ({
  resolveOpenRouterCredential: vi.fn(),
}));
vi.mock('../src/file-list', () => ({
  resolveSweepFiles: vi.fn(),
}));
vi.mock('../src/slop-grader-runner', () => ({
  runSlopGrader: vi.fn(),
  SWEEP_TIMEOUT_MS: 20 * 60 * 1000,
}));

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolveOpenRouterCredential } from '../src/credential';
import { resolveSweepFiles } from '../src/file-list';
import { runSlopGrader } from '../src/slop-grader-runner';
import { runSweep } from '../src/run-sweep';

describe('runSweep', () => {
  beforeEach(() => {
    vi.mocked(writeFileSync).mockReset();
    vi.mocked(mkdirSync).mockReset();
    vi.mocked(resolveOpenRouterCredential).mockReset();
    vi.mocked(resolveSweepFiles).mockReset();
    vi.mocked(runSlopGrader).mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('writes a DEGRADED report when credential resolution fails, without calling the runner', async () => {
    vi.mocked(resolveSweepFiles).mockReturnValue(['docs/a.md']);
    vi.mocked(resolveOpenRouterCredential).mockReturnValue({ ok: false, reason: 'missing env var' });

    await runSweep('/repo', 'drift/SLOP-REPORT.md');

    expect(runSlopGrader).not.toHaveBeenCalled();
    const [path, content] = vi.mocked(writeFileSync).mock.calls[0];
    expect(path).toBe('drift/SLOP-REPORT.md');
    expect(content).toContain('DEGRADED (missing env var)');
  });

  it('retries once after 5s on subprocess failure, then writes a DEGRADED report on second failure', async () => {
    vi.mocked(resolveSweepFiles).mockReturnValue(['docs/a.md']);
    vi.mocked(resolveOpenRouterCredential).mockReturnValue({ ok: true, apiKey: 'sk-test' });
    vi.mocked(runSlopGrader).mockResolvedValue({ ok: false, reason: 'rate limited' });

    const promise = runSweep('/repo', 'drift/SLOP-REPORT.md');
    await vi.advanceTimersByTimeAsync(5000);
    await promise;

    expect(runSlopGrader).toHaveBeenCalledTimes(2);
    const [, content] = vi.mocked(writeFileSync).mock.calls[0];
    expect(content).toContain('DEGRADED (rate limited)');
  });

  it('writes a full report when the runner succeeds on the first try', async () => {
    vi.mocked(resolveSweepFiles).mockReturnValue(['docs/a.md', 'docs/b.md']);
    vi.mocked(resolveOpenRouterCredential).mockReturnValue({ ok: true, apiKey: 'sk-test' });
    vi.mocked(runSlopGrader).mockResolvedValue({
      ok: true,
      findings: [{ file: 'docs/a.md', line: 2, rule: 'throat_clearing', severity: 'error', message: 'cut it' }],
    });

    await runSweep('/repo', 'drift/SLOP-REPORT.md');

    expect(runSlopGrader).toHaveBeenCalledTimes(1);
    const [, content] = vi.mocked(writeFileSync).mock.calls[0];
    expect(content).toContain('**Total findings**: 1');
    expect(content).toContain('### docs/a.md');
  });

  it('passes the sweep timeout, not the pre-commit default', async () => {
    vi.mocked(resolveSweepFiles).mockReturnValue(['docs/a.md']);
    vi.mocked(resolveOpenRouterCredential).mockReturnValue({ ok: true, apiKey: 'sk-test' });
    vi.mocked(runSlopGrader).mockResolvedValue({ ok: true, findings: [] });

    await runSweep('/repo', 'drift/SLOP-REPORT.md');

    expect(runSlopGrader).toHaveBeenCalledWith(['docs/a.md'], 'sk-test', 20 * 60 * 1000);
  });

  it('creates the report directory before writing', async () => {
    vi.mocked(resolveSweepFiles).mockReturnValue(['docs/a.md']);
    vi.mocked(resolveOpenRouterCredential).mockReturnValue({ ok: true, apiKey: 'sk-test' });
    vi.mocked(runSlopGrader).mockResolvedValue({ ok: true, findings: [] });

    await runSweep('/repo', 'drift/SLOP-REPORT.md');

    expect(mkdirSync).toHaveBeenCalledWith('drift', { recursive: true });
  });

  it('marks the report DEGRADED when some files failed but others succeeded', async () => {
    vi.mocked(resolveSweepFiles).mockReturnValue(['docs/a.md', 'docs/b.md']);
    vi.mocked(resolveOpenRouterCredential).mockReturnValue({ ok: true, apiKey: 'sk-test' });
    vi.mocked(runSlopGrader).mockResolvedValue({
      ok: true,
      findings: [],
      errors: ['docs/b.md: rate limited'],
    });

    await runSweep('/repo', 'drift/SLOP-REPORT.md');

    const [, content] = vi.mocked(writeFileSync).mock.calls[0];
    expect(content).toContain('DEGRADED (1 of 2 file(s) failed: docs/b.md: rate limited)');
  });

  it('degrades to a DEGRADED report instead of throwing when a collaborator throws', async () => {
    vi.mocked(resolveSweepFiles).mockImplementation(() => {
      throw new Error('not a git repository');
    });

    await expect(runSweep('/repo', 'drift/SLOP-REPORT.md')).resolves.toBeUndefined();

    const [, content] = vi.mocked(writeFileSync).mock.calls[0];
    expect(content).toContain('DEGRADED (not a git repository)');
  });
});
