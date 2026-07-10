/**
 * Orchestrates distributed skill sync end-to-end.
 * Manages sync utility, audit trail, error recovery, rollback.
 */

import { Logger } from '../utils/logger';
import { SyncError } from '../utils/errors';
import { DistributedSyncUtil, SyncResult } from './DistributedSyncUtil';
import { SyncAuditLog } from './SyncAuditLog';
import crypto from 'crypto';

interface OrchestrationConfig {
  canonicalPath: string;
  distributedPath: string;
  auditLogPath: string;
  strategy: 'pull' | 'push' | 'audit';
  actor: string; // CI/CD system, developer name
  commitHash?: string;
  dryRun?: boolean;
}

interface OrchestrationResult {
  operationId: string;
  success: boolean;
  syncResult: SyncResult;
  driftSummary: {
    total: number;
    byType: Record<string, number>;
  };
  rollbackUrl?: string;
}

class DistributedSyncOrchestrator {
  private logger: Logger;
  private auditLog: SyncAuditLog;
  private operationId: string;

  constructor(private config: OrchestrationConfig) {
    this.logger = new Logger('DistributedSyncOrchestrator');
    this.auditLog = new SyncAuditLog(config.auditLogPath);
    this.operationId = this.generateOperationId();
  }

  /**
   * Execute full sync orchestration.
   */
  async execute(): Promise<OrchestrationResult> {
    try {
      this.logger.info('Starting sync orchestration', {
        operationId: this.operationId,
        strategy: this.config.strategy,
        dryRun: this.config.dryRun,
      });

      // Load audit log
      await this.auditLog.load();

      // Run sync
      const syncUtil = new DistributedSyncUtil({
        canonicalPath: this.config.canonicalPath,
        distributedPath: this.config.distributedPath,
        strategy: this.config.strategy,
      });

      const syncResult = await syncUtil.sync();

      // Calculate drift summary
      const driftByType: Record<string, number> = {};
      for (const drift of syncResult.driftDetected) {
        driftByType[drift.type] = (driftByType[drift.type] || 0) + 1;
      }

      // Log entry
      const logEntry = {
        timestamp: new Date().toISOString(),
        id: this.operationId,
        syncType: this.config.strategy as 'pull' | 'push' | 'audit',
        skillsProcessed: syncResult.skillsProcessed,
        skillsSynced: syncResult.skillsSynced,
        driftCount: syncResult.driftDetected.length,
        errorCount: syncResult.errors.length,
        actor: this.config.actor,
        status: syncResult.success ? 'success' : syncResult.errors.length < syncResult.skillsProcessed ? 'partial' : 'failure',
        commitHash: this.config.commitHash,
        notes: this.config.dryRun ? 'DRY RUN' : undefined,
      };

      this.auditLog.append(logEntry);

      const result: OrchestrationResult = {
        operationId: this.operationId,
        success: syncResult.success,
        syncResult,
        driftSummary: {
          total: syncResult.driftDetected.length,
          byType: driftByType,
        },
        rollbackUrl: syncResult.success
          ? undefined
          : `/sync/rollback/${this.operationId}`,
      };

      this.logger.info('Sync orchestration complete', {
        operationId: this.operationId,
        success: syncResult.success,
        processed: syncResult.skillsProcessed,
        synced: syncResult.skillsSynced,
        errors: syncResult.errors.length,
      });

      return result;
    } catch (error) {
      this.logger.error('Sync orchestration failed', error as Error, {
        operationId: this.operationId,
      });
      throw new SyncError(
        `Orchestration failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get rollback instructions for a failed sync.
   */
  getRollbackInstructions(operationId: string): string {
    return this.auditLog.generateRollbackInstructions(operationId);
  }

  /**
   * Get audit log as markdown.
   */
  getAuditLogMarkdown(): string {
    return this.auditLog.exportMarkdown();
  }

  /**
   * Generate unique operation ID.
   */
  private generateOperationId(): string {
    return `sync_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }
}

export { DistributedSyncOrchestrator, OrchestrationConfig, OrchestrationResult };
