import { execFileSync } from 'node:child_process';

export function runTrmCommand(trmRoot: string, args: string[]): string {
  return execFileSync('trm', args, { cwd: trmRoot, encoding: 'utf-8' });
}
