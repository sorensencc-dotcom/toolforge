import { execFileSync } from 'node:child_process';

export function runTrmCommand(trmRoot: string, args: string[]): string {
  try {
    return execFileSync('trm', args, { cwd: trmRoot, encoding: 'utf-8' });
  } catch (error) {
    const stdout = (error as { stdout?: string }).stdout;
    if (typeof stdout === 'string' && stdout.length > 0) return stdout;
    throw error;
  }
}
