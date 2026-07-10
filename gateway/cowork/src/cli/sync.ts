#!/usr/bin/env ts-node

/**
 * CLI wrapper for distributed sync operations.
 * Usage: npm run sync:pull -- --canonical <path> --distributed <path>
 */

import { DistributedSyncOrchestrator } from '../sync';
import { Logger } from '../utils';

const logger = new Logger('SyncCLI');

async function main() {
  const args = process.argv.slice(2);
  const strategy = args[0] as 'pull' | 'push' | 'audit';

  if (!['pull', 'push', 'audit'].includes(strategy)) {
    console.error('Usage: sync [pull|push|audit] [options]');
    console.error('Options:');
    console.error('  --canonical <path>    Path to canonical skills (default: ../../skills)');
    console.error('  --distributed <path>  Path to distributed skills (default: ../../distributed/skills)');
    console.error('  --actor <name>        Actor name (default: CLI)');
    console.error('  --commit <hash>       Git commit hash');
    console.error('  --dry-run             Show what would be synced, but don\'t change');
    process.exit(1);
  }

  try {
    // Parse args
    const argMap: Record<string, string> = {};
    for (let i = 1; i < args.length; i++) {
      if (args[i].startsWith('--')) {
        const key = args[i].substring(2);
        argMap[key] = args[i + 1] || '';
        i++;
      }
    }

    const canonicalPath = argMap.canonical || '../../skills';
    const distributedPath = argMap.distributed || '../../distributed/skills';
    const actor = argMap.actor || 'CLI';
    const commitHash = argMap.commit;
    const dryRun = 'dry-run' in argMap;

    logger.info('Starting sync', {
      strategy,
      canonicalPath,
      distributedPath,
      actor,
      dryRun,
    });

    const orchestrator = new DistributedSyncOrchestrator({
      canonicalPath,
      distributedPath,
      auditLogPath: '../../../SKILL-SYNC-LOG.json',
      strategy,
      actor,
      commitHash,
      dryRun,
    });

    const result = await orchestrator.execute();

    // Output results
    console.log('\n=== Sync Results ===\n');
    console.log(`Operation ID: ${result.operationId}`);
    console.log(`Status: ${result.success ? '✅ SUCCESS' : '❌ FAILURE'}`);
    console.log(`\nProcessed: ${result.syncResult.skillsProcessed} skills`);
    console.log(`Synced: ${result.syncResult.skillsSynced} skills`);
    console.log(`Errors: ${result.syncResult.errors.length}`);
    console.log(`Drift: ${result.driftSummary.total}`);

    if (result.driftSummary.total > 0) {
      console.log('\nDrift by type:');
      for (const [type, count] of Object.entries(result.driftSummary.byType)) {
        console.log(`  - ${type}: ${count}`);
      }
    }

    if (result.syncResult.errors.length > 0) {
      console.log('\nErrors:');
      for (const error of result.syncResult.errors.slice(0, 5)) {
        console.log(`  - ${error.skillId}: ${error.error}`);
      }
      if (result.syncResult.errors.length > 5) {
        console.log(`  ... and ${result.syncResult.errors.length - 5} more`);
      }
    }

    if (result.rollbackUrl) {
      console.log(`\nRollback: ${result.rollbackUrl}`);
    }

    // Set exit code
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    logger.error('Sync failed', error as Error);
    console.error('\n❌ Sync failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
