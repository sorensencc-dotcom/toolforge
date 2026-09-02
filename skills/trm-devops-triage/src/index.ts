import { execSync } from 'child_process';
import * as path from 'path';

export interface TrmDevOpsTriageOptions {
  queuePath?: string;
  archivePath?: string;
  bufferPath?: string;
  dryRun?: boolean;
}

export function runTriageCommand(command: 'sync' | 'prune' | 'status', options: TrmDevOpsTriageOptions = {}): void {
  const repoRoot = path.resolve(__dirname, '..', '..', '..');
  const args: string[] = [command];

  if (options.queuePath) args.push('--queue', options.queuePath);
  if (options.archivePath) args.push('--archive', options.archivePath);
  if (options.bufferPath) args.push('--buffer', options.bufferPath);
  if (options.dryRun) args.push('--dry-run');

  execSync(`npx trm-devops ${args.join(' ')}`, {
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
