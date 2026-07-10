#!/usr/bin/env ts-node

/**
 * CLI wrapper for rollback operations.
 * Usage: npm run sync:rollback -- --operation-id <ID>
 */

import { SyncAuditLog } from '../sync';
import { Logger } from '../utils';

const logger = new Logger('RollbackCLI');

async function main() {
  const args = process.argv.slice(2);

  // Parse args
  const argMap: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].substring(2);
      argMap[key] = args[i + 1] || '';
      i++;
    }
  }

  const operationId = argMap['operation-id'];

  if (!operationId) {
    console.error('Usage: sync:rollback --operation-id <ID>');
    console.error('Example: npm run sync:rollback -- --operation-id sync_1720689900000_a1b2c3d4');
    process.exit(1);
  }

  try {
    logger.info('Loading audit log', { auditLogPath: '../../../SKILL-SYNC-LOG.json' });

    const auditLog = new SyncAuditLog('../../../SKILL-SYNC-LOG.json');
    await auditLog.load();

    const entry = auditLog.getById(operationId);

    if (!entry) {
      console.error(`❌ Operation not found: ${operationId}`);
      process.exit(1);
    }

    console.log('\n=== Rollback Information ===\n');
    console.log(`Operation ID: ${entry.id}`);
    console.log(`Timestamp: ${entry.timestamp}`);
    console.log(`Type: ${entry.syncType}`);
    console.log(`Status: ${entry.status}`);
    console.log(`Actor: ${entry.actor}`);
    console.log(`Skills Synced: ${entry.skillsSynced}`);

    if (entry.commitHash) {
      console.log(`Commit: ${entry.commitHash}`);
    }

    console.log('\n=== Rollback Instructions ===\n');

    const instructions = auditLog.generateRollbackInstructions(operationId);
    console.log(instructions);

    console.log('\n=== Manual Rollback Steps ===\n');
    if (entry.commitHash) {
      console.log(`1. Revert the sync commit:`);
      console.log(`   git revert ${entry.commitHash}`);
      console.log(`\n2. Verify distributed matches canonical:`);
      console.log(`   npm run sync:audit`);
      console.log(`\n3. If drift remains, re-sync from canonical:`);
      console.log(`   npm run sync:pull`);
    } else {
      console.log('⚠️  No commit hash recorded. Manual rollback required.');
      console.log('   Restore distributed/skills to state before ' + entry.timestamp);
    }

    process.exit(0);
  } catch (error) {
    logger.error('Rollback lookup failed', error as Error);
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
