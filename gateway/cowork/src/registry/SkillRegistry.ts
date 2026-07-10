/**
 * Reads and manages skill inventory from toolforge.
 * Builds in-memory registry of all 22 skills.
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { Logger } from '../utils/logger';
import { ManifestError } from '../utils/errors';

interface SkillJson {
  id: string;
  name: string;
  version: string;
  category: string;
  runtime: string;
  entrypoint: string;
  integrations?: {
    cowork?: {
      registered: boolean;
      pluginType?: string;
      status?: string;
    };
  };
}

interface RegisteredSkill {
  id: string;
  name: string;
  version: string;
  category: string;
  entrypoint: string;
  cowork: {
    registered: boolean;
    status: string;
  };
}

class SkillRegistry {
  private logger: Logger;
  private skills: Map<string, RegisteredSkill> = new Map();
  private skillsPath: string;

  constructor(skillsPath: string) {
    this.logger = new Logger('SkillRegistry');
    this.skillsPath = skillsPath;
  }

  /**
   * Load all skills from toolforge/skills/.
   */
  async load(): Promise<void> {
    try {
      this.logger.info('Loading skill registry', { path: this.skillsPath });
      const skillDirs = readdirSync(this.skillsPath, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);

      this.logger.info('Found skill directories', { count: skillDirs.length });

      for (const dir of skillDirs) {
        try {
          this.loadSkill(dir);
        } catch (error) {
          this.logger.warn('Failed to load skill', {
            skill: dir,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      this.logger.info('Skill registry loaded', { totalSkills: this.skills.size });
    } catch (error) {
      throw new ManifestError(
        `Failed to load skill registry: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Load a single skill by directory name.
   */
  private loadSkill(skillDir: string): void {
    const skillJsonPath = join(this.skillsPath, skillDir, 'skill.json');
    const content = readFileSync(skillJsonPath, 'utf-8');
    const skillJson: SkillJson = JSON.parse(content);

    if (!skillJson.id || !skillJson.name || !skillJson.version) {
      throw new ManifestError(`Missing required fields in ${skillDir}/skill.json`);
    }

    const registered = skillJson.integrations?.cowork?.registered ?? false;

    this.skills.set(skillJson.id, {
      id: skillJson.id,
      name: skillJson.name,
      version: skillJson.version,
      category: skillJson.category || 'uncategorized',
      entrypoint: skillJson.entrypoint,
      cowork: {
        registered,
        status: registered ? 'registered' : 'pending_registration',
      },
    });

    this.logger.debug('Skill loaded', {
      id: skillJson.id,
      version: skillJson.version,
    });
  }

  /**
   * Get all skills.
   */
  getAll(): RegisteredSkill[] {
    return Array.from(this.skills.values());
  }

  /**
   * Get skills by status.
   */
  getByStatus(status: 'registered' | 'pending_registration'): RegisteredSkill[] {
    return this.getAll().filter((s) => s.cowork.status === status);
  }

  /**
   * Get a single skill by ID.
   */
  getById(id: string): RegisteredSkill | undefined {
    return this.skills.get(id);
  }

  /**
   * Count total skills.
   */
  count(): number {
    return this.skills.size;
  }

  /**
   * Count registered skills.
   */
  countRegistered(): number {
    return this.getByStatus('registered').length;
  }
}

export { SkillRegistry, RegisteredSkill, SkillJson };
