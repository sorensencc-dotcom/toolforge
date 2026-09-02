/**
 * Upgrade Plan Generator
 */
import { SchemaMigrator } from './schema-migrator.js';

export class UpgradePlanner {
  generatePlan(harvesterId, currentVersion, targetVersion) {
    const compat = SchemaMigrator.validateCompatibility(currentVersion, targetVersion);
    const plan = {
      planId: `upg-plan-${Date.now()}`,
      harvesterId,
      sourceVersion: currentVersion,
      targetVersion,
      breaking: compat.breaking,
      steps: [
        { step: 1, action: 'FREEZE_HARVESTER', detail: `Set status of ${harvesterId} to paused` },
        { step: 2, action: 'BACKUP_LINEAGE_SNAPSHOT', detail: 'Export full lineage chain entries' },
        { step: 3, action: 'VERIFY_LINEAGE_INTEGRITY', detail: 'Verify seed chain from genesis' },
        { step: 4, action: 'APPLY_SCHEMA_MIGRATION', detail: `Migrate schemas to ${targetVersion}` },
        { step: 5, action: 'REACTIVATE_HARVESTER', detail: `Set status of ${harvesterId} to active` },
      ],
      rollbackSteps: [
        { step: 1, action: 'RESTORE_LINEAGE_SNAPSHOT' },
        { step: 2, action: 'REVERT_SCHEMA_VERSION', target: currentVersion },
        { step: 3, action: 'REACTIVATE_HARVESTER' },
      ],
      createdAt: new Date().toISOString(),
    };
    return plan;
  }
}
