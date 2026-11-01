import {
  createManagedWorktree,
  getManagedWorktree,
  removeManagedWorktree,
  runManagedWorktree,
  statusManagedWorktree,
} from '../../worktree/manager.js';

function commandArgs(argv) {
  const args = argv['--'];
  if (Array.isArray(args) && args.length > 0) return args;
  return Array.isArray(argv.args) ? argv.args : [];
}

export async function worktreeAction(argv, { log = console.log, error = console.error } = {}) {
  try {
    if (argv.action === 'create') {
      log(JSON.stringify(createManagedWorktree({ repo: argv.repo, name: argv.name, base: argv.base, worktreeRoot: argv.worktreeRoot }), null, 2));
      return 0;
    }
    if (argv.action === 'status') {
      log(JSON.stringify(statusManagedWorktree({ repo: argv.repo, name: argv.name, worktreeRoot: argv.worktreeRoot }), null, 2));
      return 0;
    }
    if (argv.action === 'remove') {
      log(JSON.stringify(removeManagedWorktree({ repo: argv.repo, name: argv.name, worktreeRoot: argv.worktreeRoot, force: argv.force, runId: argv.runId, cleanup: argv.cleanup }), null, 2));
      return 0;
    }
    if (argv.action === 'run') {
      const result = await runManagedWorktree({
        repo: argv.repo,
        name: argv.name,
        command: commandArgs(argv),
        worktreeRoot: argv.worktreeRoot,
        code: argv.code,
        nonCode: argv.nonCode,
        trailQuery: argv.trailQuery,
        trailFile: argv.trailFile,
        runId: argv.runId,
        timeoutMs: argv.timeoutMs,
      });
      log(JSON.stringify(result, null, 2));
      return result.code === 0 ? 0 : 1;
    }
    error(`✗ Unknown worktree action '${argv.action}'.`);
    return 2;
  } catch (e) {
    error(`✗ Worktree operation failed: ${e.message}`);
    return 2;
  }
}

export default {
  command: 'worktree <action> [args..]',
  describe: 'Manage isolated agent worktrees',
  builder: (yargs) => yargs
    .parserConfiguration({ 'populate--': true })
    .positional('action', { choices: ['create', 'run', 'status', 'remove'] })
    .option('repo', { describe: 'Absolute source repository path', type: 'string', demandOption: true })
    .option('name', { describe: 'Managed worktree name', type: 'string', demandOption: true })
    .option('base', { describe: 'Base revision for create', type: 'string' })
    .option('worktree-root', { describe: 'Absolute managed worktree root', type: 'string' })
    .option('run-id', { describe: 'Owner run identifier', type: 'string' })
    .option('force', { describe: 'Discard changes during removal', type: 'boolean', default: false })
    .option('cleanup', { describe: 'Explicit cleanup operation', type: 'boolean', default: false })
    .option('code', { describe: 'Require Trail preflight for this run', type: 'boolean' })
    .option('non-code', { describe: 'Record an explicit Trail exemption', type: 'boolean', default: false })
    .option('trail-query', { describe: 'Targeted Trail query for a code run', type: 'string' })
    .option('trail-file', { describe: 'Trail skeleton target for a code run', type: 'string' })
    .option('timeout-ms', { describe: 'Child timeout in milliseconds', type: 'number', default: 60_000 }),
  handler: async (argv) => {
    process.exitCode = await worktreeAction(argv);
  },
};
