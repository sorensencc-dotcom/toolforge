import { execFileSync } from 'node:child_process'; // noqa: SEC-AUDITOR -- current Node + fixed local built CLI, literal arguments, shell:false; see docs/USAGE.md.
import { existsSync } from 'node:fs';
import * as path from 'path';

export interface TrmDevOpsTriageOptions {
  queuePath?: string;
  archivePath?: string;
  bufferPath?: string;
  dryRun?: boolean;
}

export function runTriageCommand(command: 'sync' | 'prune' | 'status', options: TrmDevOpsTriageOptions = {}): void {
  if (!['sync', 'prune', 'status'].includes(command)) throw new Error('Unsupported triage command');
  const repoRoot = path.resolve(__dirname, '..', '..', '..');
  const cli = path.join(repoRoot, 'modules', 'trm-devops', 'dist', 'cli', 'index.js');
  if (!existsSync(cli)) throw new Error('TRM DevOps CLI build unavailable; build modules/trm-devops explicitly before invocation');
  const args: string[] = [command];

  if (options.queuePath) args.push('--queue', options.queuePath);
  if (options.archivePath) args.push('--archive', options.archivePath);
  if (options.bufferPath) args.push('--buffer', options.bufferPath);
  if (options.dryRun) args.push('--dry-run');

  execFileSync(process.execPath, [cli, ...args], {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: false,
  });
}

export function runStatus(): void {
  runTriageCommand('status');
}

if (typeof require !== 'undefined' && require.main === module) {
  runStatus();
}
