import { execFileSync } from 'node:child_process'; // noqa: SEC-AUDITOR: Tier 1 approved 2026-07-29 — fixed binary name ('trm', not user input), args passed as array (no shell, no string interpolation), so no shell-injection surface.

export function runTrmCommand(trmRoot: string, args: string[]): string {
  try {
    return execFileSync('trm', args, { cwd: trmRoot, encoding: 'utf-8' });
  } catch (error) {
    const stdout = (error as { stdout?: string }).stdout;
    if (typeof stdout === 'string' && stdout.length > 0) return stdout;
    throw error;
  }
}
