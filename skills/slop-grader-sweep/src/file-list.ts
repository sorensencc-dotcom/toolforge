// skills/slop-grader-sweep/src/file-list.ts
import { execFileSync } from 'node:child_process';
import { globSync } from 'glob';

const TRACKED_ROOTS = ['docs', 'wiki'];

function isUnderTrackedRoot(file: string): boolean {
  return (
    TRACKED_ROOTS.some((root) => file === root || file.startsWith(`${root}/`)) ||
    /(^|\/)specs\//.test(file)
  );
}

export function resolveChangedFiles(cwd: string = process.cwd()): string[] {
  const output = execFileSync(
    'git',
    ['diff', '--name-only', '--diff-filter=ACM', '--cached'],
    { cwd, encoding: 'utf8' }
  ) as unknown as string;

  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((file) => file.endsWith('.md'))
    .filter(isUnderTrackedRoot);
}

export function resolveSweepFiles(cwd: string = process.cwd()): string[] {
  const patterns = ['docs/**/*.md', 'wiki/**/*.md', '**/specs/**/*.md'];
  const results = new Set<string>();

  for (const pattern of patterns) {
    const matches = globSync(pattern, {
      cwd,
      nodir: true,
      ignore: ['**/node_modules/**'],
    }) as unknown as string[];
    for (const file of matches) {
      results.add(file);
    }
  }

  return Array.from(results).sort();
}
