import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';

vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}));

import { spawn } from 'node:child_process';
import { runSlopGrader } from '../src/slop-grader-runner';

function fakeChild() {
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    kill: (signal?: string) => void;
  };
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = vi.fn();
  return child;
}

describe('runSlopGrader', () => {
  beforeEach(() => {
    vi.mocked(spawn).mockReset();
  });

  it('resolves ok:true with parsed findings on success', async () => {
    const child = fakeChild();
    vi.mocked(spawn).mockReturnValue(child as any);

    const promise = runSlopGrader(['docs/a.md'], 'sk-test');
    child.stdout.emit('data', Buffer.from('[{"file":"docs/a.md","line":3,"rule":"empty_adverb","severity":"warning","message":"drop it"}]'));
    child.emit('close', 0);

    await expect(promise).resolves.toEqual({
      ok: true,
      findings: [{ file: 'docs/a.md', line: 3, rule: 'empty_adverb', severity: 'warning', message: 'drop it' }],
    });
  });

  it('resolves ok:true with no findings when the file list is empty', async () => {
    const result = await runSlopGrader([], 'sk-test');
    expect(result).toEqual({ ok: true, findings: [] });
    expect(spawn).not.toHaveBeenCalled();
  });

  it('resolves ok:false on non-zero exit', async () => {
    const child = fakeChild();
    vi.mocked(spawn).mockReturnValue(child as any);

    const promise = runSlopGrader(['docs/a.md'], 'sk-test');
    child.stderr.emit('data', Buffer.from('auth failed'));
    child.emit('close', 1);

    await expect(promise).resolves.toEqual({ ok: false, reason: 'auth failed' });
  });

  it('resolves ok:false on spawn error', async () => {
    const child = fakeChild();
    vi.mocked(spawn).mockReturnValue(child as any);

    const promise = runSlopGrader(['docs/a.md'], 'sk-test');
    child.emit('error', new Error('ENOENT'));

    await expect(promise).resolves.toEqual({ ok: false, reason: 'ENOENT' });
  });

  it('resolves ok:false and kills the child on timeout', async () => {
    vi.useFakeTimers();
    const child = fakeChild();
    vi.mocked(spawn).mockReturnValue(child as any);

    const promise = runSlopGrader(['docs/a.md'], 'sk-test', 30000);
    vi.advanceTimersByTime(30000);

    await expect(promise).resolves.toEqual({ ok: false, reason: 'timed out after 30000ms' });
    expect(child.kill).toHaveBeenCalledWith('SIGKILL');
    vi.useRealTimers();
  });
});
