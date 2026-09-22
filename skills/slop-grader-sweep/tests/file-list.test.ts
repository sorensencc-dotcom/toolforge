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
import { resolveChangedFiles, resolveSweepFiles } from '../src/file-list';

describe('resolveChangedFiles', () => {
  beforeEach(() => {
    vi.mocked(execFileSync).mockReset();
  });

  it('filters staged files to markdown under docs/wiki/specs', () => {
    vi.mocked(execFileSync).mockReturnValue(
      'docs/meta/specs/foo.md\nwiki/research/bar.md\nsrc/index.ts\nREADME.md\ndocs/meta/specs/nested/dir/baz.md\n' as unknown as Buffer
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
});
