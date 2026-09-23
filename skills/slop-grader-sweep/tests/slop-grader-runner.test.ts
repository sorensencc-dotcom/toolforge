import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}));

import { spawn } from 'node:child_process';
import {
  runSlopGrader,
  runSlopGraderOnFile,
  buildGraderArgs,
  parseSlopGraderJson,
  resolveGraderEntrypoint,
  RULESETS,
} from '../src/slop-grader-runner';

function fakeChild() {
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    kill: ReturnType<typeof vi.fn>;
  };
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = vi.fn();
  return child;
}

/** Drive one queued child to a successful close with the given stdout. */
function settle(child: ReturnType<typeof fakeChild>, stdout: string, code = 0) {
  if (stdout) child.stdout.emit('data', Buffer.from(stdout));
  child.emit('close', code);
}

const CLEAN_JSON = JSON.stringify({
  file: '/abs/docs/a.md',
  rules: ['/abs/no-ai-slop.md'],
  violations: { lines: [], document: {} },
  stats: { rules: 6 },
});

describe('buildGraderArgs', () => {
  it('emits one repeated -r flag per ruleset, --json, and exactly one file', () => {
    expect(buildGraderArgs('docs/a.md')).toEqual([
      '-r',
      'no-ai-slop',
      '-r',
      'tech-docs',
      '--json',
      'docs/a.md',
    ]);
  });

  it('never emits the invented check subcommand or --ruleset/--format flags', () => {
    const args = buildGraderArgs('docs/a.md');
    expect(args).not.toContain('check');
    expect(args).not.toContain('--ruleset');
    expect(args).not.toContain('--format');
    expect(args.join(' ')).not.toContain(RULESETS.join(','));
  });
});

describe('resolveGraderEntrypoint', () => {
  it('resolves the installed package entrypoint rather than relying on PATH', () => {
    const entry = resolveGraderEntrypoint();
    expect(entry).toMatch(/slop-grader\.mjs$/);
    expect(entry).toContain('@lukstei');
  });
});

describe('parseSlopGraderJson', () => {
  it('maps the real --json payload fixture into one finding per rule per line', () => {
    const raw = readFileSync(join(__dirname, 'fixtures', 'slop-grader-json-sample.json'), 'utf8');

    const result = parseSlopGraderJson(raw, 'docs/a.md');

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const lineFindings = result.findings.filter((f) => f.line > 0);
    expect(lineFindings).toEqual([
      {
        file: 'docs/a.md',
        line: 1,
        rule: 'banned_word',
        severity: 'warning',
        message: 'Our platform empowers teams...',
      },
      {
        file: 'docs/a.md',
        line: 7,
        rule: 'faux_insight',
        severity: 'warning',
        message: 'What most people get wrong about databases is simple.',
      },
      {
        file: 'docs/a.md',
        line: 7,
        rule: 'colon_reveal',
        severity: 'warning',
        message: 'What most people get wrong about databases is simple.',
      },
    ]);
  });

  it('folds document-scope violations into line-0 findings', () => {
    const raw = readFileSync(join(__dirname, 'fixtures', 'slop-grader-json-sample.json'), 'utf8');

    const result = parseSlopGraderJson(raw, 'docs/a.md');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.findings.filter((f) => f.line === 0)).toEqual([
      {
        file: 'docs/a.md',
        line: 0,
        rule: 'narrative_arc',
        severity: 'document',
        message: 'Loosely organized (score 1.4/3)',
      },
    ]);
  });

  it('returns ok:false on a shape mismatch instead of emitting undefined fields', () => {
    // The pre-fix code cast this straight to SlopFinding[].
    const legacyArrayShape = '[{"file":"docs/a.md","line":3,"rule":"empty_adverb"}]';

    const result = parseSlopGraderJson(legacyArrayShape, 'docs/a.md');

    expect(result).toEqual({
      ok: false,
      reason: 'unexpected JSON shape: expected an object at the top level',
    });
  });

  it('returns ok:false when violations.lines entries lack lineNum', () => {
    const raw = JSON.stringify({ file: 'x', rules: [], violations: { lines: [{ rules: ['a'] }], document: {} } });

    const result = parseSlopGraderJson(raw, 'docs/a.md');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain('violations.lines[]');
  });

  it('returns ok:false on unparseable output', () => {
    const result = parseSlopGraderJson('not json', 'docs/a.md');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain('invalid JSON output');
  });
});

describe('runSlopGraderOnFile', () => {
  beforeEach(() => {
    vi.mocked(spawn).mockReset();
  });

  it('spawns the resolved entrypoint under the current node binary, without a shell', async () => {
    const child = fakeChild();
    vi.mocked(spawn).mockReturnValue(child as never);

    const promise = runSlopGraderOnFile('docs/a.md', 'sk-test');
    settle(child, CLEAN_JSON);
    await promise;

    const [command, args, options] = vi.mocked(spawn).mock.calls[0] as [string, string[], any];
    expect(command).toBe(process.execPath);
    expect(args[0]).toMatch(/slop-grader\.mjs$/);
    expect(args.slice(1)).toEqual(buildGraderArgs('docs/a.md'));
    expect(options.shell).toBeUndefined();
    expect(options.env.OPENROUTER_API_KEY).toBe('sk-test');
  });

  it('resolves ok:false on non-zero exit', async () => {
    const child = fakeChild();
    vi.mocked(spawn).mockReturnValue(child as never);

    const promise = runSlopGraderOnFile('docs/a.md', 'sk-test');
    child.stderr.emit('data', Buffer.from('auth failed'));
    child.emit('close', 1);

    await expect(promise).resolves.toEqual({ ok: false, reason: 'auth failed' });
  });

  it('resolves ok:false on spawn error', async () => {
    const child = fakeChild();
    vi.mocked(spawn).mockReturnValue(child as never);

    const promise = runSlopGraderOnFile('docs/a.md', 'sk-test');
    child.emit('error', new Error('ENOENT'));

    await expect(promise).resolves.toEqual({ ok: false, reason: 'ENOENT' });
  });

  it('resolves ok:false and kills the child on timeout', async () => {
    vi.useFakeTimers();
    const child = fakeChild();
    vi.mocked(spawn).mockReturnValue(child as never);

    const promise = runSlopGraderOnFile('docs/a.md', 'sk-test', 30000);
    vi.advanceTimersByTime(30000);

    await expect(promise).resolves.toEqual({ ok: false, reason: 'timed out after 30000ms' });
    expect(child.kill).toHaveBeenCalledWith('SIGKILL');
    vi.useRealTimers();
  });
});

describe('runSlopGrader', () => {
  beforeEach(() => {
    vi.mocked(spawn).mockReset();
  });

  it('resolves ok:true with no findings when the file list is empty', async () => {
    const result = await runSlopGrader([], 'sk-test');
    expect(result).toEqual({ ok: true, findings: [] });
    expect(spawn).not.toHaveBeenCalled();
  });

  it('invokes the CLI once per file rather than spreading a file list into one argv', async () => {
    const children = [fakeChild(), fakeChild(), fakeChild()];
    let index = 0;
    vi.mocked(spawn).mockImplementation(() => {
      const child = children[index];
      index += 1;
      queueMicrotask(() => settle(child, CLEAN_JSON));
      return child as never;
    });

    const files = ['docs/a.md', 'docs/b.md', 'docs/c.md'];
    const result = await runSlopGrader(files, 'sk-test', 30000, 1);

    expect(result).toEqual({ ok: true, findings: [] });
    expect(vi.mocked(spawn).mock.calls).toHaveLength(3);
    for (const [, args] of vi.mocked(spawn).mock.calls as [string, string[]][]) {
      // Exactly one positional file per invocation.
      expect(args.filter((a) => a.endsWith('.md') && !a.endsWith('slop-grader.mjs'))).toHaveLength(1);
    }
  });

  it('keeps findings from successful files and reports per-file errors', async () => {
    const good = fakeChild();
    const bad = fakeChild();
    const queue = [good, bad];
    vi.mocked(spawn).mockImplementation(() => {
      const child = queue.shift()!;
      queueMicrotask(() => {
        if (child === good) {
          settle(
            child,
            JSON.stringify({
              file: 'docs/a.md',
              rules: [],
              violations: { lines: [{ lineNum: 3, text: 'very unique', rules: ['empty_adverb'] }], document: {} },
            })
          );
        } else {
          child.stderr.emit('data', Buffer.from('rate limited'));
          child.emit('close', 1);
        }
      });
      return child as never;
    });

    const result = await runSlopGrader(['docs/a.md', 'docs/b.md'], 'sk-test', 30000, 1);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.findings).toEqual([
      { file: 'docs/a.md', line: 3, rule: 'empty_adverb', severity: 'warning', message: 'very unique' },
    ]);
    expect(result.errors).toEqual(['docs/b.md: rate limited']);
  });

  it('resolves ok:false only when every file fails', async () => {
    vi.mocked(spawn).mockImplementation(() => {
      const child = fakeChild();
      queueMicrotask(() => {
        child.stderr.emit('data', Buffer.from('auth failed'));
        child.emit('close', 1);
      });
      return child as never;
    });

    const result = await runSlopGrader(['docs/a.md', 'docs/b.md'], 'sk-test', 30000, 1);

    expect(result).toEqual({ ok: false, reason: 'docs/a.md: auth failed' });
  });
});
