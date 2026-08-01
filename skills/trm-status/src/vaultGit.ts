import { execFileSync } from 'node:child_process'; // noqa: SEC-AUDITOR: fixed binary name ('git'), args as array, no shell — no injection surface.

export function uncommittedCount(vaultRoot: string, relPath: string): number {
  try {
    const out = execFileSync('git', ['status', '--porcelain', '--', relPath], {
      cwd: vaultRoot,
      encoding: 'utf-8',
    });
    return out.split('\n').filter((l) => l.trim().length > 0).length;
  } catch {
    return 0;
  }
}
