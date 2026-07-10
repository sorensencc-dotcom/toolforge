/**
 * Manages skill registration lifecycle with Cowork.
 * Handles bulk registration, delta updates, error recovery, rollback.
 */

import { Logger } from '../utils/logger';
import { CoworkClient, SkillManifest } from '../client';
import { RegisteredSkill } from './SkillRegistry';

interface RegistrationResult {
  skillId: string;
  success: boolean;
  pluginId?: string;
  error?: string;
  attempt: number;
}

class RegistrationManager {
  private logger: Logger;
  private results: RegistrationResult[] = [];

  constructor(private client: CoworkClient) {
    this.logger = new Logger('RegistrationManager');
  }

  /**
   * Register all unregistered skills.
   */
  async registerUnregistered(skills: RegisteredSkill[]): Promise<RegistrationResult[]> {
    const unregistered = skills.filter((s) => !s.cowork.registered);

    if (unregistered.length === 0) {
      this.logger.info('No unregistered skills found');
      return [];
    }

    this.logger.info('Starting bulk registration', { count: unregistered.length });
    this.results = [];

    for (const skill of unregistered) {
      await this.registerSkill(skill);
    }

    this.logRegistrationSummary();
    return this.results;
  }

  /**
   * Register a single skill with retry logic.
   */
  private async registerSkill(skill: RegisteredSkill): Promise<void> {
    let attempt = 0;
    const maxAttempts = 3;

    while (attempt < maxAttempts) {
      try {
        attempt++;
        this.logger.info('Registering skill', {
          skillId: skill.id,
          attempt,
        });

        const manifest: SkillManifest = {
          id: skill.id,
          name: skill.name,
          version: skill.version,
          category: skill.category,
          entrypoint: skill.entrypoint,
        };

        const response = await this.client.registerSkill(manifest);

        this.results.push({
          skillId: skill.id,
          success: true,
          pluginId: response.plugin_id,
          attempt,
        });

        this.logger.info('Skill registered successfully', {
          skillId: skill.id,
          pluginId: response.plugin_id,
        });

        return;
      } catch (error) {
        this.logger.warn('Skill registration attempt failed', {
          skillId: skill.id,
          attempt,
          error: error instanceof Error ? error.message : String(error),
        });

        if (attempt === maxAttempts) {
          this.results.push({
            skillId: skill.id,
            success: false,
            error: error instanceof Error ? error.message : String(error),
            attempt,
          });

          this.logger.error('Skill registration failed (max attempts reached)', error as Error, {
            skillId: skill.id,
          });
        } else {
          await this.sleep(1000 * attempt); // Exponential backoff
        }
      }
    }
  }

  /**
   * Get all registration results.
   */
  getResults(): RegistrationResult[] {
    return this.results;
  }

  /**
   * Get successful registrations.
   */
  getSuccessful(): RegistrationResult[] {
    return this.results.filter((r) => r.success);
  }

  /**
   * Get failed registrations.
   */
  getFailed(): RegistrationResult[] {
    return this.results.filter((r) => !r.success);
  }

  /**
   * Check if all registrations succeeded.
   */
  allSucceeded(): boolean {
    return this.results.length > 0 && this.results.every((r) => r.success);
  }

  /**
   * Log summary of registration results.
   */
  private logRegistrationSummary(): void {
    const successful = this.getSuccessful().length;
    const failed = this.getFailed().length;

    this.logger.info('Registration summary', {
      total: this.results.length,
      successful,
      failed,
      successRate: `${((successful / this.results.length) * 100).toFixed(1)}%`,
    });

    if (failed > 0) {
      this.logger.warn('Failed registrations', {
        count: failed,
        skills: this.getFailed().map((r) => r.skillId),
      });
    }
  }

  /**
   * Sleep utility for backoff.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export { RegistrationManager, RegistrationResult };
