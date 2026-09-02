/**
 * Distributed sync utility for Toolforge-to-Distributed skill synchronization.
 * Compares canonical and distributed skill states, detects drift, performs sync.
 */

import { existsSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import crypto from 'crypto';
import { Logger } from '../utils/logger';
import { SyncError } from '../utils/errors';

interface SyncConfig {
  canonicalPath: string;
  distributedPath: string;
  strategy: 'pull' | 'push' | 'audit'; // pull: canonical → distributed, push: distributed → canonical
}

interface SyncDrift {
  skillId: string;
  type: 'missing_canonical' | 'missing_distributed' | 'version_mismatch' | 'hash_mismatch';
  canonical?: string;
  distributed?: string;
}

interface SyncResult {
  strategy: string;
  timestamp: string;
  skillsProcessed: number;
  skillsSynced: number;
  driftDetected: SyncDrift[];
  errors: Array<{ skillId: string; error: string }>;
  success: boolean;
}

class DistributedSyncUtil {
  private logger: Logger;

  constructor(private config: SyncConfig) {
    this.logger = new Logger('DistributedSyncUtil');
  }

  /**
   * Execute sync based on strategy.
   */
  async sync(): Promise<SyncResult> {
    try {
      this.logger.info('Starting distributed sync', {
        strategy: this.config.strategy,
        canonical: this.config.canonicalPath,
        distributed: this.config.distributedPath,
      });

      const result: SyncResult = {
        strategy: this.config.strategy,
        timestamp: new Date().toISOString(),
        skillsProcessed: 0,
        skillsSynced: 0,
        driftDetected: [],
        errors: [],
        success: true,
      };

      // Detect drift
      const drift = this.detectDrift();
      result.driftDetected = drift;

      if (drift.length > 0) {
        this.logger.warn('Drift detected', { count: drift.length });
      }

      // Execute strategy
      switch (this.config.strategy) {
        case 'pull':
          await this.pullSync(result);
          break;
        case 'push':
          await this.pushSync(result);
          break;
        case 'audit':
          await this.auditSync(result);
          break;
      }

      result.success = result.errors.length === 0;
      this.logger.info('Sync complete', {
        strategy: this.config.strategy,
        processed: result.skillsProcessed,
        synced: result.skillsSynced,
        errors: result.errors.length,
      });

      return result;
    } catch (error) {
      throw new SyncError(
        `Distributed sync failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Pull: canonical → distributed.
   */
  private async pullSync(result: SyncResult): Promise<void> {
    const canonicalSkills = this.listSkills(this.config.canonicalPath);

    for (const skillId of canonicalSkills) {
      result.skillsProcessed++;

      try {
        const canonicalJson = this.readSkillJson(this.config.canonicalPath, skillId);
        const distributedDir = join(this.config.distributedPath, skillId);

        // Create distributed dir if missing
        if (!existsSync(distributedDir)) {
          this.logger.debug('Creating distributed skill directory', { skillId });
        }

        // Write skill.json to distributed
        const distributedJsonPath = join(distributedDir, 'skill.json');
        writeFileSync(distributedJsonPath, JSON.stringify(canonicalJson, null, 2));

        result.skillsSynced++;
        this.logger.debug('Skill synced (pull)', { skillId });
      } catch (error) {
        result.errors.push({
          skillId,
          error: error instanceof Error ? error.message : String(error),
        });
        this.logger.warn('Failed to sync skill (pull)', { skillId, error });
      }
    }
  }

  /**
   * Push: distributed → canonical (read-only, validates only).
   */
  private async pushSync(result: SyncResult): Promise<void> {
    const distributedSkills = this.listSkills(this.config.distributedPath);

    for (const skillId of distributedSkills) {
      result.skillsProcessed++;

      try {
        const distributedJson = this.readSkillJson(this.config.distributedPath, skillId);
        const canonicalJson = this.readSkillJson(this.config.canonicalPath, skillId);

        // Check version match
        if (distributedJson.version !== canonicalJson.version) {
          throw new Error(
            `Version mismatch: canonical ${canonicalJson.version}, distributed ${distributedJson.version}`,
          );
        }

        result.skillsSynced++;
        this.logger.debug('Skill validated (push)', { skillId });
      } catch (error) {
        result.errors.push({
          skillId,
          error: error instanceof Error ? error.message : String(error),
        });
        this.logger.warn('Failed to validate skill (push)', { skillId, error });
      }
    }
  }

  /**
   * Audit: compare only, no changes.
   */
  private async auditSync(result: SyncResult): Promise<void> {
    const canonicalSkills = this.listSkills(this.config.canonicalPath);

    for (const skillId of canonicalSkills) {
      result.skillsProcessed++;

      try {
        const canonicalJson = this.readSkillJson(this.config.canonicalPath, skillId);
        const distributedJsonPath = join(this.config.distributedPath, skillId, 'skill.json');

        if (!existsSync(distributedJsonPath)) {
          throw new Error('Missing in distributed');
        }

        const distributedJson = this.readSkillJson(this.config.distributedPath, skillId);

        if (canonicalJson.version !== distributedJson.version) {
          throw new Error(
            `Version mismatch: canonical ${canonicalJson.version}, distributed ${distributedJson.version}`,
          );
        }

        result.skillsSynced++;
        this.logger.debug('Skill audit OK', { skillId });
      } catch (error) {
        result.errors.push({
          skillId,
          error: error instanceof Error ? error.message : String(error),
        });
        this.logger.warn('Audit failed', { skillId, error });
      }
    }
  }

  /**
   * Detect drift between canonical and distributed.
   */
  private detectDrift(): SyncDrift[] {
    const drift: SyncDrift[] = [];
    const canonicalSkills = this.listSkills(this.config.canonicalPath);
    const distributedSkills = this.listSkills(this.config.distributedPath);

    // Check for missing distributed
    for (const skillId of canonicalSkills) {
      if (!distributedSkills.includes(skillId)) {
        drift.push({
          skillId,
          type: 'missing_distributed',
        });
      } else {
        // Check version match
        try {
          const canonicalJson = this.readSkillJson(this.config.canonicalPath, skillId);
          const distributedJson = this.readSkillJson(this.config.distributedPath, skillId);

          if (canonicalJson.version !== distributedJson.version) {
            drift.push({
              skillId,
              type: 'version_mismatch',
              canonical: canonicalJson.version,
              distributed: distributedJson.version,
            });
          }
        } catch (error) {
          this.logger.warn('Failed to check version', { skillId });
        }
      }
    }

    // Check for extra distributed (not in canonical)
    for (const skillId of distributedSkills) {
      if (!canonicalSkills.includes(skillId)) {
        drift.push({
          skillId,
          type: 'missing_canonical',
        });
      }
    }

    return drift;
  }

  /**
   * List skill directories.
   */
  private listSkills(path: string): string[] {
    if (!existsSync(path)) {
      this.logger.warn('Skills path does not exist', { path });
      return [];
    }

    return readdirSync(path, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  }

  /**
   * Read skill.json from directory.
   */
  private readSkillJson(basePath: string, skillId: string): Record<string, unknown> {
    const skillJsonPath = join(basePath, skillId, 'skill.json');

    if (!existsSync(skillJsonPath)) {
      throw new Error(`Missing skill.json: ${skillJsonPath}`);
    }

    const content = readFileSync(skillJsonPath, 'utf-8');
    return JSON.parse(content);
  }
}

export { DistributedSyncUtil, SyncConfig, SyncDrift, SyncResult };
