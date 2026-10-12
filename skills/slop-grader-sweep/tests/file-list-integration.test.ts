import { it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveChangedFiles } from '../src/file-list';

it('reads real staged paths without Git quoting or shell interpretation', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'slop-paths-'));
  const files = ['docs/a b.md', 'docs/caf\u00e9.md', 'docs/$(echo injected);&.md'];
  const git = (args: string[]) => execFileSync('git', args, { cwd, shell: false, windowsHide: true, timeout: 5000 });
  try {
    git(['init']);
    git(['config', 'core.quotePath', 'true']);
    mkdirSync(join(cwd, 'docs'));
    for (const file of files) writeFileSync(join(cwd, file), 'Fixture\n');
    git(['add', '--', 'docs']);
    expect(resolveChangedFiles(cwd).sort()).toEqual([...files].sort());
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
