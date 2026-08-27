import { execSync } from 'child_process';
import * as path from 'path';

export interface TrmClosedLoopOptions {
  vaultRoot?: string;
  skipMine?: boolean;
}

export function runClosedLoopResearch(options: TrmClosedLoopOptions = {}): void {
  const repoRoot = path.resolve(__dirname, '..', '..', '..');
  const env = {
    ...process.env,
    TRM_VAULT: options.vaultRoot ?? process.env.TRM_VAULT ?? 'C:\\Users\\soren\\trm-vault',
    TRM_SKIP_MINE: options.skipMine ? '1' : '0',
  };

  const scriptPath = path.join(repoRoot, 'scripts', 'run-closed-loop-research-v2.mjs');
  execSync(`node "${scriptPath}"`, {
    cwd: repoRoot,
    env,
    stdio: 'inherit',
  });
}

if (require.main === module) {
  runClosedLoopResearch();
}
