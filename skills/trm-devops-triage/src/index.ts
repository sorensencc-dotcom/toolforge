import { execSync } from 'child_process'; // noqa: SEC-AUDITOR args are validated by assertShellSafe before interpolation
import * as path from 'path';

export interface TrmDevOpsTriageOptions {
  queuePath?: string;
  archivePath?: string;
  bufferPath?: string;
  dryRun?: boolean;
}

const SHELL_META = /[&|;<>^%"\x27\x60$()\r\n]/;

/** Reject option values that could break out of the shell command line. */
export function assertShellSafe(arg: string): string {
  if (SHELL_META.test(arg)) throw new Error(`unsafe character in trm-devops argument: ${JSON.stringify(arg)}`);
  return arg;
}

export function runTriageCommand(command: 'sync' | 'prune' | 'status', options: TrmDevOpsTriageOptions = {}): void {
  const repoRoot = path.resolve(__dirname, '..', '..', '..');
  const args: string[] = [command];

  if (options.queuePath) args.push('--queue', options.queuePath);
  if (options.archivePath) args.push('--archive', options.archivePath);
  if (options.bufferPath) args.push('--buffer', options.bufferPath);
  if (options.dryRun) args.push('--dry-run');

  execSync(`npx trm-devops ${args.map((a) => `"${assertShellSafe(a)}"`).join(' ')}`, {
    cwd: repoRoot,
    stdio: 'inherit',
  });
}

export function runStatus(): void {
  runTriageCommand('status');
}

if (typeof require !== 'undefined' && require.main === module) {
  runStatus();
}
