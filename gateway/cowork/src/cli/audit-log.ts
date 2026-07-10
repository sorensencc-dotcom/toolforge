#!/usr/bin/env ts-node

/**
 * CLI wrapper for audit log operations.
 * Usage: npm run audit:log -- [options]
 */

import { SyncAuditLog } from '../sync';
import { Logger } from '../utils';
import { writeFileSync } from 'fs';

const logger = new Logger('AuditLogCLI');

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

  const command = args[0] || 'list';
  const format = argMap.format || 'table'; // table, markdown, json

  try {
    logger.info('Loading audit log');

    const auditLog = new SyncAuditLog('../../../SKILL-SYNC-LOG.json');
    await auditLog.load();

    const entries = auditLog.getAll();

    console.log(`\n=== Audit Log (${entries.length} entries) ===\n`);

    switch (command) {
      case 'list':
        displayList(entries, format);
        break;

      case 'summary':
        displaySummary(entries);
        break;

      case 'export':
        const outputPath = argMap.output || 'SKILL-SYNC-AUDIT.md';
        const markdown = auditLog.exportMarkdown();
        writeFileSync(outputPath, markdown);
        console.log(`✅ Exported to ${outputPath}`);
        break;

      case 'failures':
        const failures = auditLog.getByStatus('failure');
        if (failures.length === 0) {
          console.log('✅ No failures recorded');
        } else {
          console.log(`Found ${failures.length} failed sync operations:`);
          for (const entry of failures) {
            console.log(`\n  - ${entry.id}`);
            console.log(`    Time: ${entry.timestamp}`);
            console.log(`    Type: ${entry.syncType}`);
            console.log(`    Errors: ${entry.errorCount}`);
          }
        }
        break;

      default:
        console.error(`Unknown command: ${command}`);
        console.error('Commands: list, summary, export, failures');
        process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    logger.error('Audit log operation failed', error as Error);
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function displayList(entries: any[], format: string) {
  if (format === 'json') {
    console.log(JSON.stringify(entries, null, 2));
  } else if (format === 'markdown') {
    console.log('| Timestamp | ID | Type | Status | Processed | Synced | Drift | Errors |');
    console.log('|-----------|-----|------|--------|-----------|--------|-------|--------|');
    for (const entry of entries) {
      const timestamp = new Date(entry.timestamp).toLocaleString();
      console.log(
        `| ${timestamp} | ${entry.id} | ${entry.syncType} | ${entry.status} | ${entry.skillsProcessed} | ${entry.skillsSynced} | ${entry.driftCount} | ${entry.errorCount} |`,
      );
    }
  } else {
    // table format (default)
    for (const entry of entries) {
      const timestamp = new Date(entry.timestamp).toLocaleString();
      console.log(`${timestamp} | ${entry.id.substring(0, 20)}... | ${entry.syncType} | ${entry.status}`);
    }
  }
}

function displaySummary(entries: any[]) {
  if (entries.length === 0) {
    console.log('No sync operations recorded');
    return;
  }

  const successful = entries.filter((e) => e.status === 'success').length;
  const failures = entries.filter((e) => e.status === 'failure').length;
  const partial = entries.filter((e) => e.status === 'partial').length;

  const totalProcessed = entries.reduce((sum, e) => sum + e.skillsProcessed, 0);
  const totalSynced = entries.reduce((sum, e) => sum + e.skillsSynced, 0);
  const totalDrift = entries.reduce((sum, e) => sum + e.driftCount, 0);
  const totalErrors = entries.reduce((sum, e) => sum + e.errorCount, 0);

  console.log('Summary Statistics:');
  console.log(`  Total Operations: ${entries.length}`);
  console.log(`  Successful: ${successful}`);
  console.log(`  Partial: ${partial}`);
  console.log(`  Failed: ${failures}`);
  console.log(`  Success Rate: ${((successful / entries.length) * 100).toFixed(1)}%`);

  console.log('\nAggregate Metrics:');
  console.log(`  Total Skills Processed: ${totalProcessed}`);
  console.log(`  Total Skills Synced: ${totalSynced}`);
  console.log(`  Total Drift Incidents: ${totalDrift}`);
  console.log(`  Total Errors: ${totalErrors}`);

  const latest = entries[entries.length - 1];
  console.log(`\nLatest Operation:`);
  console.log(`  ID: ${latest.id}`);
  console.log(`  Time: ${latest.timestamp}`);
  console.log(`  Status: ${latest.status}`);
}

main();
