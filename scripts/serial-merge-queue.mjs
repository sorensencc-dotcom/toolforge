import { execSync } from 'child_process';

const COLOR = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

const logInfo = (msg) => console.log(`${COLOR.green}[MergeQueue] [INFO]${COLOR.reset} ${msg}`);
const logWarn = (msg) => console.log(`${COLOR.yellow}[MergeQueue] [WARN]${COLOR.reset} ${msg}`);
const logError = (msg) => console.log(`${COLOR.red}[MergeQueue] [ERROR]${COLOR.reset} ${msg}`);

/**
 * serial-merge-queue.mjs
 * Implements a strict, single-lane serial merge manager.
 * Guarantees main remains completely unbroken by executing Tier 3 validation gates.
 */
async function processMerge() {
  const args = process.argv.slice(2);
  const branchArg = args.find(arg => arg.startsWith('--branch='));
  const packetArg = args.find(arg => arg.startsWith('--packet-id='));

  const branchName = branchArg ? branchArg.split('=')[1] : null;
  const packetId = packetArg ? packetArg.split('=')[1] : null;

  if (!branchName || !packetId) {
    logError('Usage: node scripts/serial-merge-queue.mjs --branch=<branch> --packet-id=<packet-id>');
    process.exit(1);
  }

  logInfo(`Attempting integration of branch "${branchName}" for packet "${packetId}"...`);

  try {
    // 1. Checkout main branch and rebase to capture changes in lock-step
    logInfo('Switching to main branch and pulling updates...');
    execSync('git checkout main', { stdio: 'inherit' });
    execSync('git pull --rebase origin main', { stdio: 'inherit' });

    // 2. Perform merge
    logInfo(`Merging ${branchName} into main...`);
    execSync(`git merge --no-ff ${branchName} -m "chore(strike): merge packet ${packetId} safely through gate"`, { stdio: 'inherit' });

    // 3. Tier 3 Iron Validation Gate
    logInfo('Running Tier 3 Iron Validation checks on merged main branch...');
    
    logInfo('Executing test suite (npm test)...');
    execSync('npm test', { stdio: 'inherit' });

    logInfo('Executing code linter (npm run lint)...');
    execSync('npm run lint', { stdio: 'inherit' });

    logInfo('✓ Post-integration validation checks succeeded!');
    logInfo(`Packet ${packetId} successfully integrated into main.`);

    // 4. Remove the temporary git worktree safely
    logInfo(`Removing git worktree for ${packetId}...`);
    execSync(`git worktree remove .worktrees/${packetId} --force`, { stdio: 'inherit' });
    execSync(`git branch -d ${branchName}`, { stdio: 'inherit' });

    logInfo('✓ Merge queue cycle completed cleanly.');
    process.exit(0);

  } catch (err) {
    logError(`Merge or post-integration checks failed for ${packetId}. Aborting merge.`);
    
    try {
      // Abort the active merge to restore main back to safety
      execSync('git merge --abort', { stdio: 'inherit' });
    } catch (_) {
      // Ignore if merge abort failed (e.g. wasn't in merge state)
    }

    // Isolate worktree changes to quarantine directory
    logWarn(`Quarantining workspace files for failed packet ${packetId}...`);
    try {
      execSync(`node scripts/quarantine-packet.mjs --packet-id=${packetId}`, { stdio: 'inherit' });
    } catch (quarantineErr) {
      logError(`Failed to run quarantine backup: ${quarantineErr.message}`);
    }

    process.exit(1);
  }
}

processMerge();
