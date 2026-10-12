// skills/slop-grader-sweep/tests/file-list.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}));

vi.mock('glob', () => ({
  globSync: vi.fn(),
}));

import { execFileSync } from 'node:child_process';
import { globSync } from 'glob';
import { resolveChangedFiles, resolveSweepFiles, SWEEP_IGNORE } from '../src/file-list';

describe('resolveChangedFiles', () => {
  beforeEach(() => {
    vi.mocked(execFileSync).mockReset();
  });

  it('filters staged files to markdown under docs/wiki/specs', () => {
    vi.mocked(execFileSync).mockReturnValue(
      'docs/meta/specs/foo.md\0wiki/research/bar.md\0src/index.ts\0README.md\0docs/meta/specs/nested/dir/baz.md\0' as unknown as Buffer
    );

    const result = resolveChangedFiles('/repo');

    expect(result).toEqual([
      'docs/meta/specs/foo.md',
      'wiki/research/bar.md',
      'docs/meta/specs/nested/dir/baz.md',
    ]);
  });

  it('returns an empty array when nothing is staged', () => {
    vi.mocked(execFileSync).mockReturnValue('' as unknown as Buffer);

    expect(resolveChangedFiles('/repo')).toEqual([]);
  });

  it('uses fixed git arguments and treats caller cwd as literal data without a shell', () => {
    vi.mocked(execFileSync).mockReturnValue('docs/a.md\0' as unknown as Buffer);
    const cwd = "/repo/space & quote'$HOME`;literal";
    resolveChangedFiles(cwd);
    expect(execFileSync).toHaveBeenCalledWith('git', ['diff', '--name-only', '--diff-filter=ACM', '--cached', '-z'], { cwd, encoding: 'utf8', shell: false, windowsHide: true });
  });

  it('preserves hostile and quoted filenames with fixed Git argv and no shell', () => {
    const files = ['docs/a b.md', 'wiki/caf\u00e9.md', 'docs/$(echo injected);&.md', 'docs/"quoted".md', 'docs/line\nbreak.md'];
    vi.mocked(execFileSync).mockReturnValue(`${files.join('\0')}\0` as unknown as Buffer);

    expect(resolveChangedFiles('/repo')).toEqual(files);
    expect(execFileSync).toHaveBeenCalledWith(
      'git',
      ['diff', '--name-only', '--diff-filter=ACM', '--cached', '-z'],
      { cwd: '/repo', encoding: 'utf8', shell: false, windowsHide: true }
    );
  });
});

describe('resolveSweepFiles', () => {
  beforeEach(() => {
    vi.mocked(globSync).mockReset();
  });

  it('globs all three roots and de-duplicates', () => {
    vi.mocked(globSync).mockImplementation((pattern: string) => {
      if (pattern === 'docs/**/*.md') return ['docs/a.md', 'docs/meta/specs/foo.md'];
      if (pattern === 'wiki/**/*.md') return ['wiki/b.md'];
      if (pattern === '**/specs/**/*.md') return ['docs/meta/specs/foo.md'];
      return [];
    });

    const result = resolveSweepFiles('/repo');

    expect(result).toEqual(['docs/a.md', 'docs/meta/specs/foo.md', 'wiki/b.md']);
  });

  it('excludes the repo-root agent-scan.ignore noise directories', () => {
    vi.mocked(globSync).mockReturnValue([]);

    resolveSweepFiles('/repo');

    for (const [, options] of vi.mocked(globSync).mock.calls as [string, any][]) {
      expect(options.ignore).toBe(SWEEP_IGNORE);
    }
    expect(SWEEP_IGNORE).toEqual(
      expect.arrayContaining([
        '**/node_modules/**',
        '**/.claude/worktrees/**',
        '**/_kb-sync-staging/**',
        '**/archive/**',
      ])
    );
  });
});
