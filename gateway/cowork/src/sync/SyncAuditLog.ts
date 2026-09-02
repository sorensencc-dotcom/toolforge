/**
 * Append-only audit log for distributed sync operations.
 * Enables rollback and audit trail tracking.
 */

import { existsSync, readFileSync, appendFileSync } from 'fs';
import { Logger } from '../utils/logger';

interface SyncLogEntry {
  timestamp: string;
  id: string; // Unique operation ID
  syncType: 'pull' | 'push' | 'audit';
  skillsProcessed: number;
  skillsSynced: number;
  driftCount: number;
  errorCount: number;
  actor: string; // CI/CD user, developer name, etc
  status: 'success' | 'failure' | 'partial';
  commitHash?: string; // Git commit that triggered sync
  notes?: string;
}

class SyncAuditLog {
  private logger: Logger;
  private entries: SyncLogEntry[] = [];

  constructor(private logPath: string) {
    this.logger = new Logger('SyncAuditLog');
  }

  /**
   * Load existing log from file.
   */
  async load(): Promise<void> {
    try {
      if (!existsSync(this.logPath)) {
        this.logger.info('Sync log does not exist (will be created)', { path: this.logPath });
        return;
      }

      const content = readFileSync(this.logPath, 'utf-8');
      const lines = content.split('\n').filter((line) => line.trim().length > 0);

      this.entries = lines.map((line) => JSON.parse(line));
      this.logger.info('Sync log loaded', { entries: this.entries.length });
    } catch (error) {
      this.logger.error('Failed to load sync log', error as Error, { path: this.logPath });
    }
  }

  /**
   * Append entry to log.
   */
  append(entry: SyncLogEntry): void {
    this.entries.push(entry);

    try {
      const line = JSON.stringify(entry);
      appendFileSync(this.logPath, line + '\n');
      this.logger.info('Sync log entry appended', {
        id: entry.id,
        type: entry.syncType,
        status: entry.status,
      });
    } catch (error) {
      this.logger.error('Failed to append to sync log', error as Error);
    }
  }

  /**
   * Get all entries.
   */
  getAll(): SyncLogEntry[] {
    return [...this.entries];
  }

  /**
   * Get entries by sync type.
   */
  getBySyncType(syncType: 'pull' | 'push' | 'audit'): SyncLogEntry[] {
    return this.entries.filter((e) => e.syncType === syncType);
  }

  /**
   * Get entries by status.
   */
  getByStatus(status: 'success' | 'failure' | 'partial'): SyncLogEntry[] {
    return this.entries.filter((e) => e.status === status);
  }

  /**
   * Get most recent entry (latest first).
   */
  getLatest(): SyncLogEntry | undefined {
    return this.entries.length > 0 ? this.entries[this.entries.length - 1] : undefined;
  }

  /**
   * Get entry by ID.
   */
  getById(id: string): SyncLogEntry | undefined {
    return this.entries.find((e) => e.id === id);
  }

  /**
   * Get entries after timestamp (for rollback).
   */
  getAfter(timestamp: string): SyncLogEntry[] {
    return this.entries.filter((e) => new Date(e.timestamp) > new Date(timestamp));
  }

  /**
   * Generate rollback instructions.
   */
  generateRollbackInstructions(fromId: string): string {
    const entry = this.getById(fromId);
    if (!entry) {
      return `No entry found with ID: ${fromId}`;
    }

    const instructions = [
      `# Rollback from sync operation ${fromId}`,
      ``,
      `Sync Type: ${entry.syncType}`,
      `Timestamp: ${entry.timestamp}`,
      `Status: ${entry.status}`,
      ``,
      `To rollback:`,
      `1. Revert distributed skills to state before ${entry.timestamp}`,
      `2. Run git revert on the sync commit (if applicable)`,
      `3. Verify canonical and distributed match with 'audit' strategy`,
      `4. Run new sync with 'pull' strategy to restore canonical state`,
    ];

    return instructions.join('\n');
  }

  /**
   * Export log as markdown table.
   */
  exportMarkdown(): string {
    const lines = [
      '# Skill Sync Audit Log',
      '',
      '| Timestamp | ID | Type | Status | Processed | Synced | Drift | Errors | Actor |',
      '|-----------|-----|------|--------|-----------|--------|-------|--------|-------|',
    ];

    for (const entry of this.entries) {
      const timestamp = new Date(entry.timestamp).toLocaleString();
      lines.push(
        `| ${timestamp} | ${entry.id} | ${entry.syncType} | ${entry.status} | ${entry.skillsProcessed} | ${entry.skillsSynced} | ${entry.driftCount} | ${entry.errorCount} | ${entry.actor} |`,
      );
    }

    return lines.join('\n');
  }
}

export { SyncAuditLog, SyncLogEntry };
