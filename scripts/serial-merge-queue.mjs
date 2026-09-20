import { execFileSync } from 'node:child_process';

const STAGING_REF = 'refs/heads/_integration_staging';
const TIMEOUT = { timeout: 60000, killSignal: 'SIGKILL', stdio: 'inherit' };
const log = (level, message) => console.log(`[MergeQueue] [${level}] ${message}`);
const git = (args, options = {}) => execFileSync('git', args, { stdio: 'inherit', ...options });
const gate = (cwd, command, args) => execFileSync(command, args, { ...TIMEOUT, cwd });

async function processMerge() {
  const args = process.argv.slice(2);
  const branchName = args.find(arg => arg.startsWith('--branch='))?.slice(9);
  const packetId = args.find(arg => arg.startsWith('--packet-id='))?.slice(12);
  if (!branchName || !packetId) {
    log('ERROR', 'Usage: node scripts/serial-merge-queue.mjs --branch=<branch> --packet-id=<packet-id>');
    process.exitCode = 1;
    return;
  }

  const originalBranch = execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim();
  let baseSha;
  let stagingCreated = false;
  let worktreePath;
  try {
    git(['checkout', 'main']);
    git(['pull', '--rebase', 'origin', 'main']);
    baseSha = execFileSync('git', ['rev-parse', 'main'], { encoding: 'utf8' }).trim();
    worktreePath = `.worktrees/_integration-${packetId}`;
    git(['update-ref', STAGING_REF, baseSha]);
    stagingCreated = true;
    git(['worktree', 'add', '--detach', worktreePath, STAGING_REF]);
    git(['-C', worktreePath, 'merge', '--no-ff', branchName, '-m', `chore(strike): stage packet ${packetId}`]);

    log('INFO', 'Running Tier 3 Iron Gate checks with 60-second limits...');
    gate(worktreePath, 'npm', ['test']);
    gate(worktreePath, 'npm', ['run', 'lint']);

    git(['update-ref', STAGING_REF, execFileSync('git', ['-C', worktreePath, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()]);
    git(['checkout', 'main']);
    git(['merge', '--ff-only', STAGING_REF]);
    log('INFO', `Packet ${packetId} integrated successfully.`);
  } catch (error) {
    log('ERROR', `Integration failed for ${packetId}; rolling staging back to ${baseSha || 'base'}.`);
    if (stagingCreated && baseSha) {
      try { git(['update-ref', STAGING_REF, baseSha]); } catch {}
      try { git(['-C', worktreePath, 'reset', '--hard', baseSha]); } catch {}
    }
    try { git(['checkout', 'main']); } catch {}
    try { git(['worktree', 'remove', worktreePath, '--force']); } catch {}
    try { execFileSync('node', ['scripts/quarantine-packet.mjs', `--packet-id=${packetId}`], { stdio: 'inherit' }); } catch (quarantineError) { log('ERROR', quarantineError.message); }
    process.exitCode = 1;
  } finally {
    if (worktreePath) {
      try { git(['worktree', 'remove', worktreePath, '--force']); } catch {}
    }
    if (stagingCreated) {
      try { git(['update-ref', '-d', STAGING_REF]); } catch {}
    }
    if (originalBranch && originalBranch !== 'main') {
      try { git(['checkout', originalBranch]); } catch {}
    }
  }
}

processMerge();