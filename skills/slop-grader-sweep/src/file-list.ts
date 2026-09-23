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

/**
 * Noise directories excluded from the sweep, mirroring the repo-root
 * `agent-scan.ignore` list. Without these the sweep grades vendored,
 * generated, and archived markdown — cost with no signal.
 */
export const SWEEP_IGNORE = [
  '**/node_modules/**',
  '**/.claude/worktrees/**',
  '**/_kb-sync-staging/**',
  '**/archive/**',
  '**/.venv/**',
  '**/dist/**',
  '**/build/**',
  '**/.next/**',
  '**/.webpack/**',
  '**/coverage/**',
  '**/.cache/**',
  '**/out/**',
  '**/target/**',
  '**/.context/retros/**',
];

export function resolveSweepFiles(cwd: string = process.cwd()): string[] {
  const patterns = ['docs/**/*.md', 'wiki/**/*.md', '**/specs/**/*.md'];
  const results = new Set<string>();

  for (const pattern of patterns) {
    const matches = globSync(pattern, {
      cwd,
      nodir: true,
      ignore: SWEEP_IGNORE,
    }) as unknown as string[];
    for (const file of matches) {
      results.add(file);
    }
  }

  return Array.from(results).sort();
}
